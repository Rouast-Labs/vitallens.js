import { VitalLensWidgetBase } from './VitalLensWidgetBase';
import { VitalLensOptions, VitalLensResult, Vital } from '../types';
import widget from './vitals-scan.html';
import logoUrl from '../../assets/logo.svg';

enum ScanState {
  IDLE = 'idle',
  DETECTING_FACE = 'detecting_face',
  SCANNING = 'scanning',
  COMPLETE = 'complete',
  FAILED = 'failed',
}

interface ScanRequirement {
  minDuration: number;
  requiredVitals: Vital[];
}

const MODEL_REQUIREMENTS: Record<string, ScanRequirement> = {
  'vitallens-2.0': {
    minDuration: 30,
    requiredVitals: ['heart_rate', 'respiratory_rate', 'hrv_sdnn', 'hrv_rmssd'],
  },
  default: {
    minDuration: 30,
    requiredVitals: ['heart_rate', 'respiratory_rate'],
  },
};

const CIRCUMFERENCE = 932;

export class VitalLensVitalsScan extends VitalLensWidgetBase {
  private state: ScanState = ScanState.IDLE;

  private warmupStartTime: number = 0;
  private scanStartTime: number | null = null;
  private lastFrameTime = 0;

  private readonly ROLLING_WINDOW_SIZE = 15;
  private recentFaceConf: number[] = [];
  private recentPpgConf: number[] = [];
  private recentRespConf: number[] = [];

  private readonly WARMUP_DURATION = 3.33;
  private readonly FACE_GATE_FRAMES = 3;
  private consecutiveFaceFrames = 0;

  private readonly THRESHOLD_FACE = 0.5;
  private readonly THRESHOLD_PPG = 0.5;
  private readonly THRESHOLD_RESP = 0.5;
  private readonly FINAL_VITAL_THRESHOLD = 0.6;

  private retryCount: number = 0;
  private readonly MAX_RETRIES = 2;
  private statusMessageTimeout: number | null = null;

  private startButton!: HTMLButtonElement;
  private restartButton!: HTMLButtonElement;
  private detailsButton!: HTMLButtonElement;
  private videoElement!: HTMLVideoElement;
  private aperture!: HTMLElement;
  private progressRing!: SVGPathElement;
  private statusText!: HTMLElement;
  private resultCard!: HTMLElement;
  private hrvContainer!: HTMLElement;
  private debugOverlay!: HTMLElement;

  private valHr!: HTMLElement;
  private valRr!: HTMLElement;
  private valSdnn!: HTMLElement;
  private valRmssd!: HTMLElement;

  private confHr!: HTMLElement;
  private confRr!: HTMLElement;
  private confSdnn!: HTMLElement;
  private confRmssd!: HTMLElement;
  private valFaceConf!: HTMLElement;
  private faceConfDisplay!: HTMLElement;

  constructor() {
    super();
    this.shadowRoot!.innerHTML = widget.replace(/__LOGO_URL__/g, logoUrl);
  }

  protected getElements(): void {
    this.startButton = this.shadowRoot!.querySelector('#btn-start')!;
    this.restartButton = this.shadowRoot!.querySelector('#btn-restart')!;
    this.detailsButton = this.shadowRoot!.querySelector('#btn-details')!;
    this.videoElement = this.shadowRoot!.querySelector('#video')!;
    this.aperture = this.shadowRoot!.querySelector('#aperture')!;
    this.progressRing = this.shadowRoot!.querySelector('#progress-fg')!;
    this.statusText = this.shadowRoot!.querySelector('#status-text')!;
    this.debugOverlay = this.shadowRoot!.querySelector('#debug-overlay')!;
    this.resultCard = this.shadowRoot!.querySelector('#result-card')!;

    this.hrvContainer = this.shadowRoot!.querySelector('#hrv-container')!;
    this.valHr = this.shadowRoot!.querySelector('#val-hr')!;
    this.valRr = this.shadowRoot!.querySelector('#val-rr')!;
    this.valSdnn = this.shadowRoot!.querySelector('#val-sdnn')!;
    this.valRmssd = this.shadowRoot!.querySelector('#val-rmssd')!;

    this.confHr = this.shadowRoot!.querySelector('#conf-hr')!;
    this.confRr = this.shadowRoot!.querySelector('#conf-rr')!;
    this.confSdnn = this.shadowRoot!.querySelector('#conf-sdnn')!;
    this.confRmssd = this.shadowRoot!.querySelector('#conf-rmssd')!;
    this.valFaceConf = this.shadowRoot!.querySelector('#val-face-conf')!;
    this.faceConfDisplay =
      this.shadowRoot!.querySelector('#face-conf-display')!;
  }

  connectedCallback() {
    super.connectedCallback();
    this.startButton.addEventListener('click', () => this.startFlow());
    this.restartButton.addEventListener('click', () => this.resetFlow());
    this.detailsButton.addEventListener('click', () => this.toggleDetails());
    this.updateStateUI(ScanState.IDLE);
  }

  protected async initVitalLensInstance(
    options: Partial<VitalLensOptions> = {}
  ): Promise<void> {
    await super.initVitalLensInstance({
      ...options,
      method: 'vitallens',
      overrideFpsTarget: 15,
      fDetFs: 1.0,
      waveformMode: 'complete',
    });

    if (this.vitalLensInstance) {
      this.vitalLensInstance.addEventListener(
        'faceDetected',
        (data: unknown) => {
          const faceData = data as {
            coordinates: number[];
            confidence: number;
          } | null;
          this.handleRawFace(faceData);
        }
      );
    }
  }

  private async startFlow() {
    this.retryCount = 0;
    this.updateStateUI(ScanState.DETECTING_FACE);
    if (!this.vitalLensInstance) {
      await this.initVitalLensInstance();
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      this.videoElement.srcObject = stream;
      await this.vitalLensInstance!.setVideoStream(stream, this.videoElement);
      this.vitalLensInstance!.setInferenceEnabled(false);
      this.vitalLensInstance!.startVideoStream();
    } catch (e) {
      console.error(e);
      this.showError('Could not access camera.');
      this.updateStateUI(ScanState.IDLE);
    }
  }

  private resetFlow() {
    if (this.statusMessageTimeout) {
      window.clearTimeout(this.statusMessageTimeout);
      this.statusMessageTimeout = null;
    }
    if (this.vitalLensInstance) this.vitalLensInstance.stopVideoStream();
    if (this.videoElement.srcObject) {
      (this.videoElement.srcObject as MediaStream)
        .getTracks()
        .forEach((t) => t.stop());
      this.videoElement.srcObject = null;
    }
    this.updateProgress(0);
    this.updateStateUI(ScanState.IDLE);
  }

  private isFaceCentered(coords: number[]): boolean {
    const [x0, y0, x1, y1] = coords;
    const faceCx = (x0 + x1) / 2;
    const faceCy = (y0 + y1) / 2;
    const vw = this.videoElement.videoWidth || 640;
    const vh = this.videoElement.videoHeight || 480;
    const xMargin = vw * 0.25;
    const yMargin = vh * 0.25;
    return (
      faceCx > xMargin &&
      faceCx < vw - xMargin &&
      faceCy > yMargin &&
      faceCy < vh - yMargin
    );
  }

  private handleRawFace(
    face: { coordinates: number[]; confidence: number } | null
  ) {
    if (this.state !== ScanState.DETECTING_FACE) return;
    let message = 'Position face in oval';
    let validFrame = false;
    if (face) {
      const isCentered = this.isFaceCentered(face.coordinates);
      if (face.confidence < 0.7) {
        message = 'Face not clear';
      } else if (!isCentered) {
        message = 'Center your face';
      } else {
        message = 'Hold still...';
        validFrame = true;
      }
    }
    this.statusText.textContent = message;
    if (validFrame) this.consecutiveFaceFrames++;
    else this.consecutiveFaceFrames = 0;

    if (this.consecutiveFaceFrames >= this.FACE_GATE_FRAMES) {
      this.beginScanning();
    }
  }

  private beginScanning() {
    this.updateStateUI(ScanState.SCANNING);
    this.warmupStartTime = Date.now() / 1000;
    this.scanStartTime = null;
    this.lastFrameTime = this.warmupStartTime;

    this.recentFaceConf = [];
    this.recentPpgConf = [];
    this.recentRespConf = [];

    this.statusText.textContent = 'Calibrating...';

    this.vitalLensInstance!.reset();
    this.vitalLensInstance!.setInferenceEnabled(true);
  }

  private updateRollingAverage(buffer: number[], newValue: number): number {
    buffer.push(newValue);
    if (buffer.length > this.ROLLING_WINDOW_SIZE) {
      buffer.shift();
    }
    return buffer.reduce((a, b) => a + b, 0) / buffer.length;
  }

  protected updateUI(result: VitalLensResult): void {
    if (this.state !== ScanState.SCANNING) return;
    const now = Date.now() / 1000;

    const faceConfArray = result.face?.confidence || [];
    const ppgConfArray = result.vital_signs?.ppg_waveform?.confidence || [];
    const respConfArray =
      result.vital_signs?.respiratory_waveform?.confidence || [];

    if (faceConfArray.length === 0) return;

    const curFace = faceConfArray[faceConfArray.length - 1];
    const curPpg = ppgConfArray.length
      ? ppgConfArray[ppgConfArray.length - 1]
      : 0;
    const curResp = respConfArray.length
      ? respConfArray[respConfArray.length - 1]
      : 0;

    const avgFace = this.updateRollingAverage(this.recentFaceConf, curFace);
    const avgPpg = this.updateRollingAverage(this.recentPpgConf, curPpg);
    const avgResp = this.updateRollingAverage(this.recentRespConf, curResp);

    this.debugOverlay.textContent = `Face: ${avgFace.toFixed(2)} | PPG: ${avgPpg.toFixed(2)} | Resp: ${avgResp.toFixed(2)}`;

    const totalElapsed = now - this.warmupStartTime;
    const isInWarmup = totalElapsed < this.WARMUP_DURATION;

    if (isInWarmup) {
      if (!this.scanStartTime) {
        this.updateProgress(0);
        if (this.statusText.textContent !== 'Calibrating...') {
          this.statusText.textContent = 'Calibrating...';
        }
      }
      return;
    }

    if (!this.scanStartTime) {
      this.scanStartTime = now;
      this.statusText.textContent = 'Scanning...';
    }

    if (this.recentFaceConf.length >= this.ROLLING_WINDOW_SIZE) {
      if (
        avgFace < this.THRESHOLD_FACE ||
        avgPpg < this.THRESHOLD_PPG ||
        avgResp < this.THRESHOLD_RESP
      ) {
        console.warn(
          `[Scan Reset] Low signal quality. Face:${avgFace.toFixed(2)}, PPG:${avgPpg.toFixed(2)}, Resp:${avgResp.toFixed(2)}`
        );
        this.handleScanIssue('Signal lost. Hold still.');
        return;
      }
    }

    const scanElapsed = now - this.scanStartTime;
    const modelName = result.model_used || 'vitallens-2.0';
    const reqKey =
      Object.keys(MODEL_REQUIREMENTS).find((k) => modelName.includes(k)) ||
      'default';
    const reqs = MODEL_REQUIREMENTS[reqKey];

    const progress = Math.min(scanElapsed / reqs.minDuration, 1.0);
    this.updateProgress(progress);

    if (scanElapsed >= reqs.minDuration) {
      this.finishScan(result, reqs.requiredVitals);
    }
  }

  private handleScanIssue(reason: string) {
    this.retryCount++;
    if (this.statusMessageTimeout) {
      window.clearTimeout(this.statusMessageTimeout);
      this.statusMessageTimeout = null;
    }

    if (this.retryCount > this.MAX_RETRIES) {
      this.vitalLensInstance!.setInferenceEnabled(false);
      this.statusText.textContent = 'Could not get clear reading.';
      this.updateStateUI(ScanState.FAILED);
    } else {
      this.statusText.textContent = reason + ' Restarting...';
      this.statusMessageTimeout = window.setTimeout(() => {
        this.statusMessageTimeout = null;
      }, 3000);
      this.beginScanning();
    }
  }

  private finishScan(result: VitalLensResult, requiredVitals: Vital[]) {
    this.vitalLensInstance!.setInferenceEnabled(false);
    this.vitalLensInstance!.stopVideoStream();

    const { vital_signs } = result;

    const allLowConf = requiredVitals.every((v) => {
      const val = vital_signs[v];
      if (!val || !('confidence' in val)) return true;

      let confidenceVal: number;
      if (Array.isArray(val.confidence)) {
        confidenceVal =
          val.confidence.length > 0
            ? val.confidence[val.confidence.length - 1]
            : 0;
      } else {
        confidenceVal = val.confidence ?? 0;
      }

      return confidenceVal < this.FINAL_VITAL_THRESHOLD;
    });

    if (allLowConf) {
      this.handleScanIssue('Measurements too uncertain.');
      return;
    }

    const formatVal = (v: any) => {
      if (!v || v.value === null) return '--';

      let conf = 0;
      if (Array.isArray(v.confidence)) {
        conf = v.confidence.length ? v.confidence[v.confidence.length - 1] : 0;
      } else {
        conf = v.confidence ?? 0;
      }

      if (conf < this.FINAL_VITAL_THRESHOLD) return '--';

      return v.value.toFixed(0);
    };

    this.valHr.textContent = formatVal(vital_signs.heart_rate);
    this.valRr.textContent = formatVal(vital_signs.respiratory_rate);

    const hasSdnn =
      (vital_signs.hrv_sdnn?.confidence ?? 0) >= this.FINAL_VITAL_THRESHOLD;
    const hasRmssd =
      (vital_signs.hrv_rmssd?.confidence ?? 0) >= this.FINAL_VITAL_THRESHOLD;

    if (hasSdnn || hasRmssd) {
      this.hrvContainer.classList.remove('hidden');
      this.valSdnn.textContent = formatVal(vital_signs.hrv_sdnn);
      this.valRmssd.textContent = formatVal(vital_signs.hrv_rmssd);
    } else {
      this.hrvContainer.classList.add('hidden');
    }

    const getConf = (v: any): number => {
      if (!v || !('confidence' in v)) return 0;
      if (Array.isArray(v.confidence)) {
        return v.confidence.length ? v.confidence[v.confidence.length - 1] : 0;
      }
      return v.confidence ?? 0;
    };

    const toPct = (val: number) => (val * 100).toFixed(0) + '%';

    this.confHr.textContent = toPct(getConf(vital_signs.heart_rate));
    this.confRr.textContent = toPct(getConf(vital_signs.respiratory_rate));
    this.confSdnn.textContent = toPct(getConf(vital_signs.hrv_sdnn));
    this.confRmssd.textContent = toPct(getConf(vital_signs.hrv_rmssd));

    const faceConfs = result.face?.confidence || [];
    const avgFace = faceConfs.length
      ? faceConfs.reduce((a, b) => a + b, 0) / faceConfs.length
      : 0;
    this.valFaceConf.textContent = toPct(avgFace);

    this.updateStateUI(ScanState.COMPLETE);
  }

  private toggleDetails() {
    const confRows = this.shadowRoot!.querySelectorAll('.conf-row');
    const faceDisplay = this.shadowRoot!.querySelector('#face-conf-display');
    const btn = this.shadowRoot!.querySelector('#btn-details');

    const isHidden = faceDisplay?.classList.contains('hidden');

    if (isHidden) {
      confRows.forEach((el) => el.classList.remove('hidden'));
      faceDisplay?.classList.remove('hidden');
      if (btn) btn.textContent = 'Hide Details';
    } else {
      confRows.forEach((el) => el.classList.add('hidden'));
      faceDisplay?.classList.add('hidden');
      if (btn) btn.textContent = 'View Details';
    }
  }

  private updateProgress(percent: number) {
    const offset = CIRCUMFERENCE - percent * CIRCUMFERENCE;
    this.progressRing.style.strokeDashoffset = offset.toString();
  }

  private updateStateUI(newState: ScanState) {
    this.state = newState;

    this.startButton.classList.add('hidden');
    this.aperture.classList.remove('scanning');
    this.resultCard.classList.remove('visible');
    this.statusText.classList.remove('visible');
    this.statusText.style.color = '#fff';
    this.debugOverlay.classList.add('hidden');

    switch (newState) {
      case ScanState.IDLE:
        this.startButton.classList.remove('hidden');
        break;
      case ScanState.DETECTING_FACE:
        this.statusText.classList.add('visible');
        this.debugOverlay.classList.remove('hidden');
        break;
      case ScanState.SCANNING:
        this.statusText.textContent = 'Scanning...';
        this.statusText.classList.add('visible');
        this.aperture.classList.add('scanning');
        this.debugOverlay.classList.remove('hidden');
        break;
      case ScanState.COMPLETE:
        this.resultCard.classList.add('visible');
        break;
      case ScanState.FAILED:
        this.statusText.classList.add('visible');
        this.statusText.style.color = '#ff4444';
        this.startButton.textContent = 'Retry';
        this.startButton.classList.remove('hidden');
        break;
    }
  }

  protected resetUI(): void {}
}

customElements.define('vitallens-vitals-scan', VitalLensVitalsScan);
