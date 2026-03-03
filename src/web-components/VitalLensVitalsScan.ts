import { VitalLensWidgetBase } from './VitalLensWidgetBase';
import { VitalLensOptions, VitalLensResult, Vital } from '../types';
import widget from './vitals-scan.html';
import logoUrl from '../../assets/logo.svg';

enum ScanState {
  IDLE = 'idle',
  SEARCHING = 'searching',
  WARMING_UP = 'warmingUp',
  TRACKING = 'tracking',
  RECOVERING = 'recovering',
  ISSUE = 'issue',
  COMPLETED = 'completed',
}

const ICON_BOLT = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M11.251.068a.5.5 0 0 1 .227.58L9.677 6.5H13a.5.5 0 0 1 .364.843l-8 8.5a.5.5 0 0 1-.842-.49L6.323 9.5H3a.5.5 0 0 1-.364-.843l8-8.5a.5.5 0 0 1 .615-.09z"/></svg>`;
const ICON_LEAF = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;"><path d="M0.004,2.018c-0,0 3.845,-0.848 6.317,-0.745c2.473,0.103 5.363,0.932 6.932,2.595c1.371,1.455 2.181,3.357 2.513,5.295c0.399,2.33 0.167,4.591 0.167,4.591c-0,-0 -1.278,-2.833 -2.991,-4.61c-2.549,-2.643 -6.431,-4.037 -6.431,-4.037c0,0 3.377,2.399 5.03,4.131c2.252,2.357 3.373,4.947 3.373,4.947c-0,0 -2.196,0.851 -5.65,0.437c-1.639,-0.196 -4.155,-1.186 -6.493,-4.654c-1.996,-2.96 -2.836,-6.909 -2.767,-7.95Z"/></svg>`;

const DEBUG_MODE = false;
const CIRCUMFERENCE = 932;

export class VitalLensVitalsScan extends VitalLensWidgetBase {
  private state: ScanState = ScanState.IDLE;
  private targetFps: number = 15;

  private accumulatedScanTime: number = 0;
  private lastFrameTime: number | null = null;
  private stateStartTime: number | null = null;
  private strikeCount: number = 0;

  private ppgConfHistory: number[] = [];
  private respConfHistory: number[] = [];
  private faceConfHistory: number[] = [];
  private totalFramesProcessed: number = 0;

  private finalDurationStr: string = '';
  private els: Record<string, HTMLElement> = {};

  private readonly scanDuration = 30.0;
  private readonly warmUpDuration = 3.0;
  private readonly recoveryTimeout = 10.0;
  private readonly vitalConfThreshold = 0.8;
  private readonly hrvConfThreshold = 0.7;

  constructor() {
    super();
    this.shadowRoot!.innerHTML = widget.replace(/__LOGO_URL__/g, logoUrl);

    const leafContainer = this.shadowRoot!.querySelector('#icon-leaf-container');
    const boltContainer = this.shadowRoot!.querySelector('#icon-bolt-container');
    if (leafContainer) leafContainer.innerHTML = ICON_LEAF;
    if (boltContainer) boltContainer.innerHTML = ICON_BOLT;
  }

  protected getElements(): void {
    const query = (id: string) => this.shadowRoot!.querySelector(id) as HTMLElement;
    this.els = {
      startScreen: query('#start-screen'),
      scanScene: query('#scan-scene'),
      headerTitle: query('#header-title'),
      startButton: query('#btn-start'),
      stopButton: query('#btn-stop'),
      modeSwitch: query('#mode-switch'),
      modeTitle: query('#mode-title'),
      modeDesc: query('#mode-desc'),
      animCheckbox: query('#anim-checkbox'),
      iconLeaf: query('#icon-leaf-container'),
      iconBolt: query('#icon-bolt-container'),
      restartButton: query('#btn-restart'),
      detailsButton: query('#btn-details'),
      video: query('#video'),
      aperture: query('#aperture'),
      progressRing: query('#progress-fg'),
      statusText: query('#status-text'),
      debugOverlay: query('#debug-overlay'),
      resultCard: query('#result-card'),
      hrvContainer: query('#hrv-container'),
      valHr: query('#val-hr'),
      valRr: query('#val-rr'),
      valSdnn: query('#val-sdnn'),
      valRmssd: query('#val-rmssd'),
      confHr: query('#conf-hr'),
      confRr: query('#conf-rr'),
      confSdnn: query('#conf-sdnn'),
      confRmssd: query('#conf-rmssd'),
      valFaceConf: query('#val-face-conf'),
      valDuration: query('#val-duration'),
      detailsSection: query('#details-section'),
    };
  }

  connectedCallback() {
    super.connectedCallback();

    this.els.startButton.addEventListener('click', () => this.startFlow());
    this.els.stopButton.addEventListener('click', () => this.resetToIdle());
    this.els.restartButton.addEventListener('click', () => this.resetToIdle());
    this.els.detailsButton.addEventListener('click', () => this.toggleDetails());
    this.els.modeSwitch.addEventListener('click', () => this.toggleMode());

    const cb = this.els.animCheckbox as HTMLInputElement;
    cb.addEventListener('change', () => {
      if (cb.checked) this.classList.add('anim-enabled');
      else this.classList.remove('anim-enabled');
    });

    if (this.hasAttribute('fx-enabled')) {
      cb.checked = true;
      this.classList.add('anim-enabled');
    }

    const defaultMode = this.getAttribute('default-mode');
    if (defaultMode === 'standard') {
      this.targetFps = 30;
      this.els.iconLeaf.classList.remove('active', 'eco');
      this.els.iconBolt.classList.add('active', 'std');
      this.els.modeTitle.textContent = 'Standard Mode';
      this.els.modeDesc.textContent = 'Higher accuracy, requires faster connection';
    } else {
      this.targetFps = 15;
      this.els.iconLeaf.classList.add('active', 'eco');
      this.els.iconBolt.classList.remove('active', 'std');
      this.els.modeTitle.textContent = 'Eco Mode';
      this.els.modeDesc.textContent = 'Standard accuracy, for slower connections';
    }

    this.updateStateUI(ScanState.IDLE, '');
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopCamera();
  }

  protected async initVitalLensInstance(options: Partial<VitalLensOptions> = {}): Promise<void> {
    await super.initVitalLensInstance({
      ...options,
      method: 'vitallens',
      overrideFpsTarget: this.targetFps,
      waveformMode: 'incremental',
    });

    this.vitalLensInstance?.addEventListener('faceDetected', this.handleFaceDetected.bind(this));
  }

  private handleFaceDetected(face: unknown) {
    const isPresent = face !== null;
    if (
      this.state !== ScanState.IDLE &&
      this.state !== ScanState.COMPLETED &&
      this.state !== ScanState.ISSUE
    ) {
      // If we lose the face while actively scanning or calibrating, immediately issue a strike.
      if (!isPresent && this.state !== ScanState.SEARCHING) {
        this.handleIssue("Face lost.");
      }
    }
  }

  protected handleStreamReset(event: { message: string }): void {
    super.handleStreamReset(event);
    if (this.state !== ScanState.IDLE && this.state !== ScanState.COMPLETED) {
      this.handleIssue("Connection unstable.");
    }
  }

  private stopCamera() {
    const videoEl = this.els.video as HTMLVideoElement;
    if (!videoEl || !videoEl.srcObject) return;
    const stream = videoEl.srcObject as MediaStream;
    stream.getTracks().forEach((track) => {
      track.stop();
      stream.removeTrack(track);
    });
    videoEl.srcObject = null;
  }

  private toggleMode() {
    this.targetFps = this.targetFps === 15 ? 30 : 15;

    if (this.targetFps === 15) {
      this.els.iconLeaf.classList.add('active', 'eco');
      this.els.iconBolt.classList.remove('active', 'std');
      this.els.modeTitle.textContent = 'Eco Mode';
      this.els.modeDesc.textContent = 'Good accuracy, for slower connection';
    } else {
      this.els.iconLeaf.classList.remove('active', 'eco');
      this.els.iconBolt.classList.add('active', 'std');
      this.els.modeTitle.textContent = 'Standard Mode';
      this.els.modeDesc.textContent = 'Higher accuracy, requires faster connection';
    }
  }

  private async startFlow() {
    this.strikeCount = 0;
    this.accumulatedScanTime = 0;
    this.totalFramesProcessed = 0;
    this.faceConfHistory = [];
    this.ppgConfHistory = [];
    this.respConfHistory = [];
    this.lastFrameTime = null;

    this.updateStateUI(ScanState.SEARCHING, 'Position face in oval');
    this.stateStartTime = Date.now() / 1000;

    if (this.vitalLensInstance) this.vitalLensInstance.stopVideoStream();
    this.stopCamera();

    await this.initVitalLensInstance();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      (this.els.video as HTMLVideoElement).srcObject = stream;
      await this.vitalLensInstance!.setVideoStream(stream, this.els.video as HTMLVideoElement);

      this.vitalLensInstance!.setInferenceEnabled(true);
      this.vitalLensInstance!.startVideoStream();
    } catch (e) {
      console.error(e);
      this.showError('Could not access camera.');
      this.updateStateUI(ScanState.IDLE, '');
    }
  }

  private transitionTo(newState: ScanState, message: string) {
    this.updateStateUI(newState, message);
    this.stateStartTime = Date.now() / 1000;

    if (newState === ScanState.ISSUE) {
      this.vitalLensInstance?.stopVideoStream();
      setTimeout(() => {
        if (this.state === ScanState.ISSUE) {
          this.resetToIdle();
        }
      }, 2000);
    }
  }

  private handleIssue(message: string) {
    this.strikeCount += 1;
    if (this.strikeCount >= 3) {
      this.transitionTo(ScanState.ISSUE, message);
    } else {
      this.updateStateUI(ScanState.SEARCHING, `${message} Retrying...`);
      this.accumulatedScanTime = 0.0;
      this.updateProgress(0);
      this.stateStartTime = Date.now() / 1000;
      this.lastFrameTime = null;
      this.vitalLensInstance?.reset();
      this.ppgConfHistory = [];
      this.respConfHistory = [];
      this.faceConfHistory = [];
    }
  }

  private isFaceGood(result: VitalLensResult): boolean {
    if (!result.face || !result.face.coordinates || result.face.coordinates.length === 0) return false;
    const coords = result.face.coordinates[result.face.coordinates.length - 1];
    const [x0, y0, x1, y1] = coords;
    
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const w = x1 - x0;
    
    const video = this.els.video as HTMLVideoElement;
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;

    const nCx = cx / vw;
    const nCy = cy / vh;
    const nW = w / vw;

    return nCx > 0.3 && nCx < 0.7 && nCy > 0.3 && nCy < 0.7 && nW > 0.15;
  }

  protected updateUI(result: VitalLensResult): void {
    if (this.state === ScanState.IDLE || this.state === ScanState.COMPLETED || this.state === ScanState.ISSUE) return;

    const framesInThisUpdate = result.time ? result.time.length : 1;
    this.totalFramesProcessed += framesInThisUpdate;

    if (result.face?.confidence) {
      this.faceConfHistory.push(...result.face.confidence);
    }
    
    if (result.vital_signs?.ppg_waveform?.confidence) {
      const confs = result.vital_signs.ppg_waveform.confidence;
      this.ppgConfHistory.push(...(Array.isArray(confs) ? confs : [confs as number]));
    }
    
    if (result.vital_signs?.respiratory_waveform?.confidence) {
      const confs = result.vital_signs.respiratory_waveform.confidence;
      this.respConfHistory.push(...(Array.isArray(confs) ? confs : [confs as number]));
    }

    const samplesInOneSecond = Math.round(this.targetFps);

    const lastSecFaceConf = this.faceConfHistory.slice(-samplesInOneSecond);
    const avgFaceConfLastSec = lastSecFaceConf.length ? lastSecFaceConf.reduce((a, b) => a + b, 0) / lastSecFaceConf.length : 0.0;

    const lastSecPpgConf = this.ppgConfHistory.slice(-samplesInOneSecond);
    const avgPpgConfLastSec = lastSecPpgConf.length ? lastSecPpgConf.reduce((a, b) => a + b, 0) / lastSecPpgConf.length : 0.0;

    const isLowSignal = avgPpgConfLastSec < 0.5 || avgFaceConfLastSec < 0.5;
    const goodFace = this.isFaceGood(result);

    const now = Date.now() / 1000;
    const elapsedInState = this.stateStartTime ? now - this.stateStartTime : 0;

    if (this.state === ScanState.TRACKING || this.state === ScanState.RECOVERING) {
      if (this.lastFrameTime) {
        this.accumulatedScanTime += (now - this.lastFrameTime);
        this.updateProgress(Math.min(this.accumulatedScanTime / this.scanDuration, 1.0));
      }
      this.lastFrameTime = now;

      if (this.accumulatedScanTime >= this.scanDuration) {
        this.finishScan(result);
        return;
      }
    } else {
      this.lastFrameTime = null;
    }

    switch (this.state) {
      case ScanState.SEARCHING:
        if (goodFace) this.transitionTo(ScanState.WARMING_UP, "Calibrating... Hold still.");
        break;
      case ScanState.WARMING_UP:
        if (elapsedInState >= this.warmUpDuration) {
          this.transitionTo(ScanState.TRACKING, "Scanning...");
          this.lastFrameTime = now;
        }
        break;
      case ScanState.TRACKING:
        if (!goodFace) this.transitionTo(ScanState.RECOVERING, "Adjust position...");
        else if (isLowSignal) this.transitionTo(ScanState.RECOVERING, "Improve lighting...");
        break;
      case ScanState.RECOVERING:
        if (goodFace && !isLowSignal) {
          this.transitionTo(ScanState.TRACKING, "Scanning...");
        } else if (elapsedInState >= this.recoveryTimeout) {
          this.handleIssue("Could not recover conditions.");
        } else {
          const currentIssueMsg = !goodFace ? "Adjust position..." : "Improve lighting...";
          if (this.els.statusText.textContent !== currentIssueMsg) {
            this.els.statusText.textContent = currentIssueMsg;
          }
        }
        break;
    }
  }

  private finishScan(result: VitalLensResult) {
    this.vitalLensInstance!.setInferenceEnabled(false);
    this.vitalLensInstance!.stopVideoStream();
    this.stopCamera();

    const vs = result.vital_signs;

    const requiredVitals = result.model_used?.includes('vitallens-2.0') 
      ? ['heart_rate', 'respiratory_rate', 'hrv_sdnn', 'hrv_rmssd'] 
      : ['heart_rate', 'respiratory_rate'];

    const getConf = (val?: number | number[]) => Array.isArray(val) ? (val[val.length - 1] ?? 0) : (val ?? 0);

    const allConfident = requiredVitals.every((v) => {
      const val = vs[v];
      if (!val) return true;
      const thresh = v.startsWith('hrv_') ? this.hrvConfThreshold : this.vitalConfThreshold;
      return getConf(val.confidence) >= thresh;
    });

    if (!allConfident) {
      this.startFlow();
      this.els.statusText.textContent = 'Measurements uncertain. Retrying...';
      return;
    }

    this.renderResults(result, getConf);
    this.updateStateUI(ScanState.COMPLETED, '');
  }

  private resetToIdle() {
    if (this.vitalLensInstance) this.vitalLensInstance.stopVideoStream();
    this.stopCamera();
    this.updateProgress(0);
    this.accumulatedScanTime = 0;
    this.updateStateUI(ScanState.IDLE, '');
  }

  private updateProgress(percent: number) {
    const offset = CIRCUMFERENCE - percent * CIRCUMFERENCE;
    this.els.progressRing.style.strokeDashoffset = offset.toString();
  }

  private updateStateUI(newState: ScanState, message: string) {
    this.state = newState;
    const { startScreen, scanScene, resultCard, aperture, statusText, debugOverlay, stopButton, headerTitle } = this.els;

    startScreen.classList.add('hidden');
    scanScene.classList.remove('visible');
    resultCard.classList.remove('visible');

    aperture.classList.remove('scanning');
    stopButton.classList.remove('visible');
    debugOverlay.classList.add('hidden');
    statusText.style.color = '#fff';
    statusText.textContent = message;

    headerTitle.classList.remove('visible');

    switch (newState) {
      case ScanState.IDLE:
        startScreen.classList.remove('hidden');
        headerTitle.classList.add('visible');
        this.els.startButton.textContent = 'Start Scan';
        break;

      case ScanState.SEARCHING:
      case ScanState.WARMING_UP:
        scanScene.classList.add('visible');
        statusText.classList.add('visible');
        stopButton.classList.add('visible');
        if (DEBUG_MODE) debugOverlay.classList.remove('hidden');
        break;

      case ScanState.TRACKING:
        scanScene.classList.add('visible');
        statusText.classList.add('visible');
        aperture.classList.add('scanning');
        stopButton.classList.add('visible');
        if (DEBUG_MODE) debugOverlay.classList.remove('hidden');
        break;

      case ScanState.RECOVERING:
      case ScanState.ISSUE:
        scanScene.classList.add('visible');
        statusText.classList.add('visible');
        statusText.style.color = '#ff4444';
        stopButton.classList.add('visible');
        if (DEBUG_MODE) debugOverlay.classList.remove('hidden');
        break;

      case ScanState.COMPLETED:
        resultCard.classList.add('visible');
        headerTitle.classList.add('visible');
        break;
    }
  }

  private renderResults(result: VitalLensResult, getConf: (val?: number | number[]) => number) {
    const vs = result.vital_signs;
    const fmt = (val: number | null | undefined) => val !== null && val !== undefined ? val.toFixed(0) : '--';
    const pct = (val: number | null | undefined) => ((val ?? 0) * 100).toFixed(0) + '%';

    this.els.valHr.textContent = fmt(vs.heart_rate?.value);
    this.els.valRr.textContent = fmt(vs.respiratory_rate?.value);

    const sdnnConf = getConf(vs.hrv_sdnn?.confidence);
    const hasHrv = sdnnConf >= this.hrvConfThreshold;

    this.els.hrvContainer.classList.toggle('hidden', !hasHrv);
    if (hasHrv) {
      this.els.valSdnn.textContent = fmt(vs.hrv_sdnn?.value);
      this.els.valRmssd.textContent = fmt(vs.hrv_rmssd?.value);
    }

    this.els.confHr.textContent = pct(getConf(vs.heart_rate?.confidence));
    this.els.confRr.textContent = pct(getConf(vs.respiratory_rate?.confidence));
    this.els.confSdnn.textContent = pct(getConf(vs.hrv_sdnn?.confidence));
    this.els.confRmssd.textContent = pct(getConf(vs.hrv_rmssd?.confidence));

    const avgFace = this.faceConfHistory.length ? this.faceConfHistory.reduce((a, b) => a + b, 0) / this.faceConfHistory.length : 0;
    this.els.valFaceConf.textContent = pct(avgFace);

    const duration = result.fps ? this.totalFramesProcessed / result.fps : 0;
    this.finalDurationStr = `${duration.toFixed(1)}s (≈${this.totalFramesProcessed}f)`;
    this.els.valDuration.textContent = this.finalDurationStr;
  }

  private toggleDetails() {
    const rows = this.shadowRoot!.querySelectorAll('.conf-row');
    const isHidden = this.els.detailsSection.classList.contains('hidden');

    rows.forEach((el) => el.classList.toggle('hidden', !isHidden));
    this.els.detailsSection.classList.toggle('hidden', !isHidden);
    this.els.detailsButton.textContent = isHidden ? 'Hide Details' : 'View Details';
  }

  protected resetUI(): void {}
}

customElements.define('vitallens-vitals-scan', VitalLensVitalsScan);