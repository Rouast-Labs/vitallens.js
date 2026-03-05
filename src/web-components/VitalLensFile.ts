import { VitalLensBase } from './VitalLensBase';
import { VitalLensResult } from '../types';
import { VitalMetadataCache } from '../utils/VitalMetadataCache';
import template from './file.html';

type FileState = 'idle' | 'processing' | 'completed' | 'error';

export class VitalLensFile extends VitalLensBase {
  private state: FileState = 'idle';

  private startScreen!: HTMLElement;
  private processingScreen!: HTMLElement;
  private resultScreen!: any; // Reference to vitallens-result
  private errorScreen!: HTMLElement;
  private progressText!: HTMLElement;
  private errorText!: HTMLElement;
  private fileInput!: HTMLInputElement;
  private retryBtn!: HTMLButtonElement;

  constructor() {
    super();
    this.shadowRoot!.innerHTML = template;
  }

  connectedCallback() {
    super.connectedCallback();

    this.startScreen.addEventListener('start', () => this.fileInput.click());
    this.fileInput.addEventListener('change', (e) => this.handleFileSelection(e));
    this.resultScreen.addEventListener('done', () => this.resetToIdle());
    this.retryBtn.addEventListener('click', () => this.resetToIdle());

    // Explicitly initialize the UI state
    this.transitionState('idle');
  }

  protected getElements(): void {
    this.startScreen = this.shadowRoot!.querySelector('#startScreen')!;
    this.processingScreen = this.shadowRoot!.querySelector('#processingScreen')!;
    this.resultScreen = this.shadowRoot!.querySelector('#resultScreen')!;
    this.errorScreen = this.shadowRoot!.querySelector('#errorScreen')!;
    this.progressText = this.shadowRoot!.querySelector('#progressText')!;
    this.errorText = this.shadowRoot!.querySelector('#errorText')!;
    this.fileInput = this.shadowRoot!.querySelector('#fileInput')!;
    this.retryBtn = this.shadowRoot!.querySelector('#retryBtn')!;
  }

  private async handleFileSelection(event: Event) {
    const target = event.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;

    const file = target.files[0];
    if (!file.type.startsWith('video/')) {
      this.showFileError('Please select a valid video file.');
      return;
    }

    this.transitionState('processing');
    this.progressText.textContent = 'Processing video...';

    try {
      await this.initVitalLensInstance({ waveformMode: 'global' });
      
      this.vitalLensInstance!.addEventListener('fileProgress', (msg: any) => {
        this.progressText.textContent = msg as string;
      });

      const result = await this.vitalLensInstance!.processVideoFile(file);
      this.showResults(result);
    } catch (err: any) {
      console.error(err);
      this.showFileError(err.message || 'An error occurred during processing.');
    } finally {
      // Clear the input value so the same file can be selected again if needed
      this.fileInput.value = '';
    }
  }

  private transitionState(newState: FileState) {
    this.state = newState;
    this.startScreen.style.display = newState === 'idle' ? 'block' : 'none';
    this.processingScreen.style.display = newState === 'processing' ? 'flex' : 'none';
    this.resultScreen.style.display = newState === 'completed' ? 'block' : 'none';
    this.errorScreen.style.display = newState === 'error' ? 'flex' : 'none';
  }

  private showFileError(message: string) {
    this.errorText.textContent = message;
    this.transitionState('error');
  }

  private resetToIdle() {
    this.transitionState('idle');
    if (this.vitalLensInstance) {
      this.vitalLensInstance.close();
      this.vitalLensInstance = undefined;
    }
  }

  private showResults(result: VitalLensResult) {
    const vs = result.vital_signs;
    const getConf = (v: any) => Array.isArray(v?.confidence) ? v.confidence[v.confidence.length - 1] : (v?.confidence ?? 0);

    const hrConf = getConf(vs.heart_rate);
    const rrConf = getConf(vs.respiratory_rate);
    const sdnnConf = getConf(vs.hrv_sdnn);
    const rmssdConf = getConf(vs.hrv_rmssd);

    const faceConfs = result.face.confidence ?? [];
    const avgFace = faceConfs.length ? faceConfs.reduce((a, b) => a + b, 0) / faceConfs.length : 0;
    
    let duration = 0;
    if (result.time && result.time.length > 1) {
      duration = result.time[result.time.length - 1] - result.time[0];
    }
    const sampleCount = result.n ?? result.time?.length ?? 0;

    const buildVital = (id: string, value: number | null | undefined, conf: number, format: string, useShortTitle: boolean = false) => {
      if (value == null) return null;
      const meta = VitalMetadataCache.getMeta(id);
      const title = useShortTitle ? (meta?.short_name || meta?.shortName || id) : (meta?.display_name || meta?.displayName || id);
      return {
        id,
        title,
        value,
        unit: (meta?.unit || '').toUpperCase(),
        format,
        confidence: conf,
        emoji: meta?.emoji || ''
      };
    };

    const primaryVitals = [
      buildVital('heart_rate', vs.heart_rate?.value, hrConf, '%.0f', false),
      buildVital('respiratory_rate', vs.respiratory_rate?.value, rrConf, '%.0f', false)
    ].filter(Boolean) as any[];

    const secondaryVitals = [
      buildVital('hrv_sdnn', vs.hrv_sdnn?.value, sdnnConf, '%.0f', true),
      buildVital('hrv_rmssd', vs.hrv_rmssd?.value, rmssdConf, '%.0f', true)
    ].filter(Boolean) as any[];

    this.resultScreen.resultData = {
      primaryVitals,
      secondaryVitals,
      stats: { duration, sampleCount, avgFaceConf: avgFace },
      ppgWaveform: vs.ppg_waveform?.data,
      respWaveform: vs.respiratory_waveform?.data
    };

    this.transitionState('completed');
  }

  protected updateUI(result: VitalLensResult): void {
    // Unused in file mode: UI is updated completely inside showResults() once the batch finishes
  }

  protected resetUI(): void {
    this.resetToIdle();
  }
}

if (!customElements.get('vitallens-file')) {
  customElements.define('vitallens-file', VitalLensFile);
}
