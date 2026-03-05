import { VitalLens } from '../core/VitalLens.browser';
import { VitalLensOptions, VitalLensResult, Vital } from '../types';

export type SessionState =
  | 'idle'
  | 'searching'
  | 'warmingUp'
  | 'tracking'
  | 'recovering'
  | 'issue'
  | 'completed';

export abstract class VitalLensBase extends HTMLElement {
  protected vitalLensInstance?: VitalLens;
  protected apiKey: string | null = null;
  protected proxyUrl: string | null = null;
  protected latestResult: VitalLensResult | null = null;
  protected isProcessingFlag = false;
  protected supportedVitals: Vital[] = [];

  protected readonly VITAL_CONF_THRESHOLD = 0.8;
  protected readonly FACE_CONF_THRESHOLD = 0.5;
  protected readonly HRV_CONF_THRESHOLD = 0.7;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    // Redirect console.error to show in a UI popup
    const originalConsoleError = console.error.bind(console);
    console.error = (...args: unknown[]) => {
      originalConsoleError(...args);
      this.showError(args.join(' '));
    };
  }

  // Abstract methods to be implemented by subclasses
  protected abstract getElements(): void;
  protected abstract updateUI(result: VitalLensResult): void;
  protected abstract resetUI(): void;

  connectedCallback(): void {
    // This will be called by subclasses after they load their HTML
    if (this.shadowRoot!.innerHTML) {
      this.getElements();
      this.apiKey = this.getAttribute('api-key');
      this.proxyUrl = this.getAttribute('proxy-url');
    }
  }

  disconnectedCallback(): void {
    this.destroy();
  }

  protected async initVitalLensInstance(
    options: Partial<VitalLensOptions> = {}
  ): Promise<void> {
    if (this.vitalLensInstance) {
      await this.vitalLensInstance.close();
    }

    const vitalLensOptions: VitalLensOptions = {
      method: 'vitallens',
      apiKey: this.apiKey ?? undefined,
      proxyUrl: this.proxyUrl ?? undefined,
      waveformMode: 'incremental',
      ...options,
    };

    try {
      this.vitalLensInstance = new VitalLens(vitalLensOptions);
      this.vitalLensInstance.addEventListener('vitals', (result) =>
        this.handleVitalLensResults(result as VitalLensResult)
      );
      this.vitalLensInstance.addEventListener('streamReset', (event) =>
        this.handleStreamReset(event as { message: string })
      );

      setTimeout(() => {
        if (this.vitalLensInstance) {
          this.supportedVitals = this.vitalLensInstance.getSupportedVitals();
          this.updateHRVDisplay();
        }
      }, 500);
    } catch (e) {
      console.error(e);
      this.showError((e as Error).message);
    }
  }

  private handleVitalLensResults(result: VitalLensResult): void {
    this.latestResult = result;
    // Re-check vitals in case of dynamic model changes
    if (this.vitalLensInstance) {
      this.supportedVitals = this.vitalLensInstance.getSupportedVitals();
    }
    this.updateUI(result);
    this.updateHRVDisplay();
  }

  protected handleStreamReset(event: { message: string }): void {
    this.showError(event.message);
    this.isProcessingFlag = false; // Stop the processing state
    this.resetUI();
  }

  protected updateHRVDisplay(): void {
    const hrvContainer = this.shadowRoot?.querySelector(
      '#hrv-container'
    ) as HTMLElement | null;
    if (hrvContainer) {
      if (!this.supportedVitals) return;
      const hasHrv = this.supportedVitals.some((v) => v.startsWith('hrv_'));
      hrvContainer.style.display = hasHrv ? 'flex' : 'none';
    }
  }

  protected showError(message: string): void {
    const errorPopup = this.shadowRoot?.querySelector(
      '#errorPopup'
    ) as HTMLElement | null;
    if (errorPopup) {
      errorPopup.textContent = message;
      errorPopup.style.display = 'block';
      setTimeout(() => {
        errorPopup.style.display = 'none';
      }, 10000);
    }
  }

  protected isFaceGood(
    result: VitalLensResult,
    videoWidth: number,
    videoHeight: number
  ): boolean {
    if (!result.face?.coordinates || result.face.coordinates.length === 0)
      return false;

    const coords = result.face.coordinates[result.face.coordinates.length - 1];
    const [x0, y0, x1, y1] = coords;

    if (!videoWidth || !videoHeight) return false;

    const cx = (x0 + x1) / 2 / videoWidth;
    const cy = (y0 + y1) / 2 / videoHeight;
    const w = (x1 - x0) / videoWidth;

    return cx > 0.3 && cx < 0.7 && cy > 0.3 && cy < 0.7 && w > 0.15;
  }

  protected resolveFeedbackState(
    currentState: SessionState,
    result: VitalLensResult,
    faceConfHistory: number[],
    ppgConfHistory: number[],
    fps: number,
    videoWidth: number,
    videoHeight: number,
    hasEnoughData: boolean
  ): { state: SessionState; message: string } {
    const samplesInOneSecond = Math.round(fps);

    const lastSecFaceConf = faceConfHistory.slice(-samplesInOneSecond);
    const avgFaceConf = lastSecFaceConf.length
      ? lastSecFaceConf.reduce((a, b) => a + b, 0) / lastSecFaceConf.length
      : 0.0;

    const lastSecPpgConf = ppgConfHistory.slice(-samplesInOneSecond);
    const avgPpgConf = lastSecPpgConf.length
      ? lastSecPpgConf.reduce((a, b) => a + b, 0) / lastSecPpgConf.length
      : 0.0;

    const isLowSignal =
      avgPpgConf < this.VITAL_CONF_THRESHOLD ||
      avgFaceConf < this.FACE_CONF_THRESHOLD;
    const goodFace = this.isFaceGood(result, videoWidth, videoHeight);

    if (currentState === 'searching' && goodFace) {
      return { state: 'warmingUp', message: 'Calibrating... Hold still.' };
    }

    if (!goodFace) {
      return { state: 'recovering', message: 'Adjust your position.' };
    }

    if (isLowSignal) {
      return {
        state: 'recovering',
        message: 'Low confidence. Improve lighting and hold still.',
      };
    }

    if (!hasEnoughData) {
      return { state: 'warmingUp', message: 'Calibrating... Hold still.' };
    }

    return { state: 'tracking', message: 'Scanning...' };
  }

  public destroy(): void {
    if (this.vitalLensInstance) {
      this.vitalLensInstance
        .close()
        .catch((e) => console.error('Error closing VitalLens instance:', e));
    }
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = '';
    }
  }
}
