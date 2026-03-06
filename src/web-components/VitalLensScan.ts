import { VitalLensBase, SessionState } from './VitalLensBase';
import { VitalLensResult } from '../types';
import { VitalMetadataCache } from '../utils/VitalMetadataCache';
import template from './scan.html';
import logoUrl from '../../assets/logo.svg';

export class VitalLensScan extends VitalLensBase {
  private state: SessionState = 'idle';
  private currentMode: 'eco' | 'standard' = 'eco';

  private videoEl!: HTMLVideoElement;
  private startScreen!: HTMLElement;
  private resultScreen!: HTMLElement & { resultData: unknown };
  private cameraLayer!: HTMLElement;
  private messageEl!: HTMLElement;
  private statusBadge!: HTMLElement;
  private statusText!: HTMLElement;
  private progressFg!: SVGPathElement;
  private apertureWrapper!: HTMLElement;

  private readonly SCAN_DURATION = 30.0;
  private readonly WARM_UP_DURATION = 3.0;
  private readonly RECOVERY_TIMEOUT = 10.0;

  private accumulatedScanTime = 0;
  private stateStartTime = 0;
  private lastFrameTime = 0;
  private strikeCount = 0;
  private totalFramesProcessed = 0;

  private ppgConfHistory: number[] = [];
  private faceConfHistory: number[] = [];
  private respConfHistory: number[] = [];
  private ppgHistory: number[] = [];
  private respHistory: number[] = [];

  private stream: MediaStream | null = null;

  constructor() {
    super();
    this.shadowRoot!.innerHTML = template;
  }

  connectedCallback() {
    super.connectedCallback();
    this.shadowRoot!.querySelector<HTMLImageElement>('#logo')!.src = logoUrl;

    this.startScreen.addEventListener('start', () => this.startProcessing());
    this.startScreen.addEventListener('modechange', (e: Event) => {
      this.currentMode = (e as CustomEvent).detail.mode;
    });

    this.shadowRoot!.querySelector('#stopBtn')!.addEventListener('click', () =>
      this.resetToIdle()
    );
    this.resultScreen.addEventListener('done', () => this.resetToIdle());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopCamera();
    this.vitalLensInstance?.stopVideoStream();
  }

  protected getElements(): void {
    this.videoEl = this.shadowRoot!.querySelector('#video')!;
    this.startScreen = this.shadowRoot!.querySelector('#startScreen')!;
    this.resultScreen = this.shadowRoot!.querySelector('#resultScreen')!;
    this.cameraLayer = this.shadowRoot!.querySelector('#cameraLayer')!;
    this.messageEl = this.shadowRoot!.querySelector('#messageEl')!;
    this.statusBadge = this.shadowRoot!.querySelector('#statusBadge')!;
    this.statusText = this.shadowRoot!.querySelector('#statusText')!;
    this.progressFg = this.shadowRoot!.querySelector('#progress-fg')!;
    this.apertureWrapper = this.shadowRoot!.querySelector('#apertureWrapper')!;
  }

  private async startProcessing() {
    this.strikeCount = 0;
    this.accumulatedScanTime = 0;
    this.totalFramesProcessed = 0;
    this.ppgConfHistory = [];
    this.respConfHistory = [];
    this.faceConfHistory = [];
    this.ppgHistory = [];
    this.respHistory = [];
    this.updateProgress(0);

    this.isProcessingFlag = true;
    this.startScreen.style.display = 'none';
    this.resultScreen.style.display = 'none';
    this.cameraLayer.style.display = 'block';

    this.transitionState('searching', 'Position your face in the oval');

    const fps = this.currentMode === 'eco' ? 15 : 30;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user' },
      });
      this.videoEl.srcObject = this.stream;

      await this.initVitalLensInstance({
        overrideFpsTarget: fps,
        waveformMode: 'incremental',
      });

      this.vitalLensInstance!.addEventListener(
        'faceDetected',
        (face: unknown) => {
          const isPresent = face !== null;
          if (!this.isProcessingFlag) return;

          if (
            !isPresent &&
            this.state !== 'searching' &&
            this.state !== 'issue' &&
            this.state !== 'completed'
          ) {
            this.handleIssue('Face lost.');
          }
        }
      );

      await this.vitalLensInstance!.setVideoStream(this.stream, this.videoEl);
      this.vitalLensInstance!.startVideoStream();
    } catch (e) {
      console.error(e);
      const errorMsg = e instanceof Error ? e.message : String(e);
      this.resetToIdle();
      if (errorMsg.includes('API Key') || errorMsg.includes('VitalLensAPI')) {
        this.showError(errorMsg);
      } else {
        this.showError('Could not access camera. Please check permissions.');
      }
    }
  }

  private stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  private resetToIdle() {
    this.isProcessingFlag = false;
    this.vitalLensInstance?.stopVideoStream();
    this.stopCamera();

    this.startScreen.style.display = 'block';
    this.cameraLayer.style.display = 'none';
    this.resultScreen.style.display = 'none';

    this.updateProgress(0);
    this.transitionState('idle', '');
  }

  private transitionState(newState: SessionState, msg: string) {
    if (this.state !== newState) {
      this.statusBadge.className = `status-badge status-${newState}`;
      const stateLabels: Record<SessionState, string> = {
        idle: 'Idle',
        searching: 'Searching',
        warmingUp: 'Calibrating',
        tracking: 'Scanning',
        recovering: 'Recovering',
        issue: 'Issue',
        completed: 'Done',
      };
      this.statusText.textContent = stateLabels[newState];
      this.state = newState;
      this.stateStartTime = performance.now() / 1000;
      this.lastFrameTime = performance.now() / 1000;

      this.apertureWrapper.classList.toggle(
        'is-scanning',
        newState === 'tracking' || newState === 'recovering'
      );
    }

    this.messageEl.textContent = msg;

    if (newState === 'issue') {
      this.vitalLensInstance?.stopVideoStream();
      setTimeout(() => {
        if (this.state === 'issue') this.resetToIdle();
      }, 2000);
    }
  }

  private handleIssue(message: string) {
    this.strikeCount++;
    if (this.strikeCount >= 3) {
      this.transitionState('issue', message);
    } else {
      this.transitionState('searching', `${message} Retrying...`);
      this.accumulatedScanTime = 0.0;
      this.updateProgress(0);
      this.vitalLensInstance?.reset();
      this.ppgConfHistory = [];
      this.faceConfHistory = [];
    }
  }

  protected updateUI(result: VitalLensResult): void {
    if (
      !this.isProcessingFlag ||
      this.state === 'idle' ||
      this.state === 'completed' ||
      this.state === 'issue'
    )
      return;

    const framesInThisUpdate = result.time ? result.time.length : 1;
    this.totalFramesProcessed += framesInThisUpdate;

    if (result.face?.confidence)
      this.faceConfHistory.push(...result.face.confidence);

    if (result.waveforms?.ppg_waveform?.data) {
      this.ppgHistory.push(...result.waveforms.ppg_waveform.data);
    }
    if (result.waveforms?.ppg_waveform?.confidence) {
      const c = result.waveforms.ppg_waveform.confidence;
      this.ppgConfHistory.push(...(Array.isArray(c) ? c : [c]));
    }

    if (result.waveforms?.respiratory_waveform?.data) {
      this.respHistory.push(...result.waveforms.respiratory_waveform.data);
    }
    if (result.waveforms?.respiratory_waveform?.confidence) {
      const c = result.waveforms.respiratory_waveform.confidence;
      this.respConfHistory.push(...(Array.isArray(c) ? c : [c]));
    }

    const fps = this.currentMode === 'eco' ? 15 : 30;
    const now = performance.now() / 1000;
    const elapsedInState = now - this.stateStartTime;

    // Define what "hasEnoughData" means for the Scan warmup phase
    const hasEnoughDataForScan =
      this.state === 'searching'
        ? false
        : this.state === 'warmingUp'
          ? elapsedInState >= this.WARM_UP_DURATION
          : true;

    // Ask the base class to evaluate the data
    const feedback = this.resolveFeedbackState(
      this.state,
      result,
      this.faceConfHistory,
      this.ppgConfHistory,
      fps,
      this.videoEl.videoWidth,
      this.videoEl.videoHeight,
      hasEnoughDataForScan
    );

    // Apply Scan-specific time accumulation
    if (this.state === 'tracking' || this.state === 'recovering') {
      this.accumulatedScanTime += now - this.lastFrameTime;
      this.updateProgress(
        Math.min(this.accumulatedScanTime / this.SCAN_DURATION, 1.0)
      );

      if (this.accumulatedScanTime >= this.SCAN_DURATION) {
        this.finishScan(result);
        return;
      }
    }
    this.lastFrameTime = now;

    // Apply Scan-specific failure timeout for recovery
    if (this.state === 'recovering' && feedback.state === 'recovering') {
      if (elapsedInState >= this.RECOVERY_TIMEOUT) {
        this.handleIssue('Could not recover conditions.');
        return;
      }
    }

    this.transitionState(feedback.state, feedback.message);
  }

  private finishScan(result: VitalLensResult) {
    this.isProcessingFlag = false;
    this.vitalLensInstance?.stopVideoStream();
    this.stopCamera();

    this.transitionState('completed', '');
    this.cameraLayer.style.display = 'none';
    this.resultScreen.style.display = 'block';

    const avgFace = this.faceConfHistory.length
      ? this.faceConfHistory.reduce((a, b) => a + b, 0) /
        this.faceConfHistory.length
      : 0;
    const duration =
      this.totalFramesProcessed /
      (result.fps ?? (this.currentMode === 'eco' ? 15 : 30));

    const vs = result.vitals;
    const getConf = (v: { confidence?: number | number[] } | undefined) =>
      Array.isArray(v?.confidence)
        ? v.confidence[v.confidence.length - 1]
        : (v?.confidence ?? 0);

    const hrConf = getConf(vs.heart_rate);
    const rrConf = getConf(vs.respiratory_rate);
    const sdnnConf = getConf(vs.hrv_sdnn);
    const rmssdConf = getConf(vs.hrv_rmssd);

    const buildVital = (
      id: string,
      value: number | null | undefined,
      conf: number,
      format: string,
      useShortTitle: boolean = false
    ) => {
      const meta = VitalMetadataCache.getMeta(id);
      const title = useShortTitle
        ? meta?.short_name || meta?.shortName || id
        : meta?.display_name || meta?.displayName || id;
      return {
        id,
        title,
        value: value ?? null,
        unit: (meta?.unit || '').toUpperCase(),
        format,
        confidence: conf,
        emoji: meta?.emoji || '',
      };
    };

    const primaryVitals = [
      buildVital(
        'heart_rate',
        hrConf >= this.VITAL_CONF_THRESHOLD ? vs.heart_rate?.value : null,
        hrConf,
        '%.0f',
        false
      ),
      buildVital(
        'respiratory_rate',
        rrConf >= this.VITAL_CONF_THRESHOLD ? vs.respiratory_rate?.value : null,
        rrConf,
        '%.0f',
        false
      ),
    ];

    const secondaryVitals = [
      buildVital(
        'hrv_sdnn',
        sdnnConf >= this.HRV_CONF_THRESHOLD ? vs.hrv_sdnn?.value : null,
        sdnnConf,
        '%.0f',
        true
      ),
      buildVital(
        'hrv_rmssd',
        rmssdConf >= this.HRV_CONF_THRESHOLD ? vs.hrv_rmssd?.value : null,
        rmssdConf,
        '%.0f',
        true
      ),
    ].filter((v) => v.value !== null);

    this.resultScreen.resultData = {
      primaryVitals,
      secondaryVitals,
      stats: {
        duration,
        sampleCount: this.totalFramesProcessed,
        avgFaceConf: avgFace,
      },
      ppgWaveform: this.ppgHistory,
      respWaveform: this.respHistory,
    };
  }

  private updateProgress(percent: number) {
    const offset = 100 - percent * 100;
    this.progressFg.style.strokeDashoffset = offset.toString();
  }

  protected resetUI(): void {
    this.resetToIdle();
  }
}

const register = (tagName: string, klass: CustomElementConstructor) => {
  if (!customElements.get(tagName)) {
    customElements.define(tagName, klass);
  }
};

try {
  register('vitallens-scan', VitalLensScan);
  register('vitallens-vitals-scan', VitalLensScan);
} catch {
  // Silent: Probably duplicate registration
}
