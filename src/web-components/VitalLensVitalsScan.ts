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
  FACE_LOST = 'face_lost',
}

const ICON_BOLT = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M11.251.068a.5.5 0 0 1 .227.58L9.677 6.5H13a.5.5 0 0 1 .364.843l-8 8.5a.5.5 0 0 1-.842-.49L6.323 9.5H3a.5.5 0 0 1-.364-.843l8-8.5a.5.5 0 0 1 .615-.09z"/></svg>`;
const ICON_LEAF = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;"><path d="M0.004,2.018c-0,0 3.845,-0.848 6.317,-0.745c2.473,0.103 5.363,0.932 6.932,2.595c1.371,1.455 2.181,3.357 2.513,5.295c0.399,2.33 0.167,4.591 0.167,4.591c-0,-0 -1.278,-2.833 -2.991,-4.61c-2.549,-2.643 -6.431,-4.037 -6.431,-4.037c0,0 3.377,2.399 5.03,4.131c2.252,2.357 3.373,4.947 3.373,4.947c-0,0 -2.196,0.851 -5.65,0.437c-1.639,-0.196 -4.155,-1.186 -6.493,-4.654c-1.996,-2.96 -2.836,-6.909 -2.767,-7.95Z"/></svg>`;

const DEBUG_MODE = false;

const CONFIG = {
  LOCAL_WINDOW: 3,
  THRESHOLD_PRESENCE: 0.5,
  FACE_GATE_FRAMES: 3,
  API_WINDOW_SEC: 1.0,
  THRESHOLD_QUALITY: 0.5,
  FINAL_THRESHOLD: 0.6,
  WARMUP_SEC: 3.0,
  MAX_RETRIES: 3,
  MIN_DURATION_DEFAULT: 30,
};

const CIRCUMFERENCE = 932;

export class VitalLensVitalsScan extends VitalLensWidgetBase {
  private state: ScanState = ScanState.IDLE;
  private targetFps: number = 15;

  private accumulatedApiTime: number = 0;
  private currentApiSessionStart: number | null = null;
  private finalDurationStr: string = '';

  private warmupStart: number = 0;
  private scanStart: number | null = null;
  private statusTimeout: number | null = null;
  private retryCount: number = 0;
  private isOffCenter = false;

  private consecutiveFaceFrames = 0;

  private apiBuffers = {
    face: [] as number[],
    ppg: [] as number[],
    resp: [] as number[],
  };

  private els: Record<string, HTMLElement> = {};

  constructor() {
    super();
    this.shadowRoot!.innerHTML = widget.replace(/__LOGO_URL__/g, logoUrl);

    const leafContainer = this.shadowRoot!.querySelector(
      '#icon-leaf-container'
    );
    const boltContainer = this.shadowRoot!.querySelector(
      '#icon-bolt-container'
    );
    if (leafContainer) leafContainer.innerHTML = ICON_LEAF;
    if (boltContainer) boltContainer.innerHTML = ICON_BOLT;
  }

  protected getElements(): void {
    const query = (id: string) =>
      this.shadowRoot!.querySelector(id) as HTMLElement;
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
    this.els.stopButton.addEventListener('click', () => this.resetFlow());
    this.els.restartButton.addEventListener('click', () => this.resetFlow());
    this.els.detailsButton.addEventListener('click', () =>
      this.toggleDetails()
    );
    this.els.modeSwitch.addEventListener('click', () => this.toggleMode());

    const cb = this.els.animCheckbox as HTMLInputElement;
    cb.addEventListener('change', () => {
      if (cb.checked) {
        this.classList.add('anim-enabled');
      } else {
        this.classList.remove('anim-enabled');
      }
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
      this.els.modeDesc.textContent =
        'Higher accuracy, requires faster connection';
    } else {
      this.targetFps = 15;
      this.els.iconLeaf.classList.add('active', 'eco');
      this.els.iconBolt.classList.remove('active', 'std');
      this.els.modeTitle.textContent = 'Eco Mode';
      this.els.modeDesc.textContent =
        'Standard accuracy, for slower connections';
    }

    this.updateStateUI(ScanState.IDLE);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopCamera();
  }

  protected async initVitalLensInstance(
    options: Partial<VitalLensOptions> = {}
  ): Promise<void> {
    await super.initVitalLensInstance({
      ...options,
      method: 'vitallens',
      overrideFpsTarget: this.targetFps,
      fDetFs: 1.0,
      waveformMode: 'complete',
    });

    if (this.vitalLensInstance) {
      this.vitalLensInstance.addEventListener(
        'faceDetected',
        (data: unknown) => {
          this.onLocalFaceDetected(
            data as { coordinates: number[]; confidence: number } | null
          );
        }
      );
    }
  }

  // ===========================================================================
  // HARDWARE & UI MANAGEMENT
  // ===========================================================================

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
      this.els.modeDesc.textContent =
        'Higher accuracy, requires faster connection';
    }
  }

  // ===========================================================================
  // STREAM A: LOCAL PRESENCE LOGIC (1Hz)
  // ===========================================================================

  private onLocalFaceDetected(
    face: { coordinates: number[]; confidence: number } | null
  ) {
    if (this.state === ScanState.FACE_LOST) return;

    const currentConfidence = face ? face.confidence : 0;

    if (this.state === ScanState.DETECTING_FACE) {
      this.handleDetectingState(face);
    } else if (this.state === ScanState.SCANNING) {
      if (currentConfidence < CONFIG.THRESHOLD_PRESENCE) {
        if (DEBUG_MODE)
          console.warn(
            `[Local Watchdog] Face lost (Conf: ${currentConfidence}). Triggering Hard Reset.`
          );
        this.triggerHardReset();
        return;
      }

      if (face) {
        const isCentered = this.isFaceCentered(face.coordinates);
        if (!isCentered) {
          this.isOffCenter = true;
          this.els.statusText.textContent = 'Center your face';
        } else {
          this.isOffCenter = false;
        }
      }
    }
  }

  private handleDetectingState(
    face: { coordinates: number[]; confidence: number } | null
  ) {
    let message = 'Position face in oval';
    let isValid = false;

    if (face) {
      const isCentered = this.isFaceCentered(face.coordinates);
      if (!isCentered) {
        message = 'Center your face';
      } else if (face.confidence < 0.7) {
        message = 'Face not clear';
      } else {
        message = 'Hold still...';
        isValid = true;
      }
    }

    this.els.statusText.textContent = message;
    this.consecutiveFaceFrames = isValid ? this.consecutiveFaceFrames + 1 : 0;

    if (this.consecutiveFaceFrames >= CONFIG.FACE_GATE_FRAMES) {
      this.transitionToScanning();
    }
  }

  // ===========================================================================
  // STREAM B: API QUALITY LOGIC (Variable Hz)
  // ===========================================================================

  protected updateUI(result: VitalLensResult): void {
    if (this.state !== ScanState.SCANNING) return;
    this.onApiResultReceived(result);
  }

  private onApiResultReceived(result: VitalLensResult) {
    const now = Date.now() / 1000;
    const apiWindowSize = Math.round(this.targetFps * CONFIG.API_WINDOW_SEC);

    const getLast = (val?: number | number[]) => {
      if (Array.isArray(val)) {
        return val.length ? val[val.length - 1] : 0;
      }
      return val ?? 0;
    };

    const avgFace = this.updateBuffer(
      this.apiBuffers.face,
      getLast(result.face?.confidence),
      apiWindowSize
    );
    const avgPpg = this.updateBuffer(
      this.apiBuffers.ppg,
      getLast(result.vital_signs?.ppg_waveform?.confidence),
      apiWindowSize
    );
    const avgResp = this.updateBuffer(
      this.apiBuffers.resp,
      getLast(result.vital_signs?.respiratory_waveform?.confidence),
      apiWindowSize
    );

    if (DEBUG_MODE) {
      this.els.debugOverlay.textContent = `Face: ${avgFace.toFixed(2)} | PPG: ${avgPpg.toFixed(2)} | Resp: ${avgResp.toFixed(2)}`;
    }

    const isMsgLocked = this.statusTimeout !== null;

    if (now - this.warmupStart < CONFIG.WARMUP_SEC) {
      if (!this.scanStart && !isMsgLocked) {
        this.els.statusText.textContent = 'Calibrating...';
      }
      return;
    }

    if (!this.scanStart) {
      this.scanStart = now;
      this.apiBuffers = { face: [], ppg: [], resp: [] };
      return;
    }

    if (!isMsgLocked) {
      if (this.isOffCenter) {
        this.els.statusText.textContent = 'Center your face';
      } else {
        this.els.statusText.textContent = 'Scanning...';
      }
    }

    if (this.apiBuffers.face.length >= apiWindowSize * 0.8) {
      if (
        avgFace < CONFIG.THRESHOLD_QUALITY ||
        avgPpg < CONFIG.THRESHOLD_QUALITY ||
        avgResp < CONFIG.THRESHOLD_QUALITY
      ) {
        this.triggerSoftReset('Signal poor. Hold still.');
        return;
      }
    }

    const requiredVitals = this.getRequirements(result.model_used);
    const progress = Math.min(
      (now - this.scanStart) / CONFIG.MIN_DURATION_DEFAULT,
      1.0
    );
    this.updateProgress(progress);

    if (now - this.scanStart >= CONFIG.MIN_DURATION_DEFAULT) {
      this.finishScan(result, requiredVitals);
    }
  }

  // ===========================================================================
  // STATE TRANSITIONS & TIME TRACKING
  // ===========================================================================

  private startApiSession() {
    if (!this.currentApiSessionStart) {
      this.currentApiSessionStart = Date.now() / 1000;
    }
  }

  private stopApiSession() {
    if (this.currentApiSessionStart) {
      const duration = Date.now() / 1000 - this.currentApiSessionStart;
      this.accumulatedApiTime += duration;
      this.currentApiSessionStart = null;
    }
  }

  private getUsageStats(): { seconds: number; frames: number } {
    let total = this.accumulatedApiTime;
    if (this.currentApiSessionStart) {
      total += Date.now() / 1000 - this.currentApiSessionStart;
    }
    return {
      seconds: total,
      frames: Math.round(total * this.targetFps),
    };
  }

  private async startFlow() {
    this.retryCount = 0;
    this.accumulatedApiTime = 0;
    this.currentApiSessionStart = null;
    this.updateStateUI(ScanState.DETECTING_FACE);

    if (this.vitalLensInstance) this.vitalLensInstance.stopVideoStream();
    this.stopCamera();

    await this.initVitalLensInstance();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      (this.els.video as HTMLVideoElement).srcObject = stream;
      await this.vitalLensInstance!.setVideoStream(
        stream,
        this.els.video as HTMLVideoElement
      );

      this.vitalLensInstance!.setInferenceEnabled(false);
      this.vitalLensInstance!.startVideoStream();
    } catch (e) {
      console.error(e);
      this.showError('Could not access camera.');
      this.updateStateUI(ScanState.IDLE);
    }
  }

  private transitionToScanning() {
    this.updateStateUI(ScanState.SCANNING);

    const now = Date.now() / 1000;
    this.warmupStart = now;
    this.scanStart = null;
    this.isOffCenter = false;

    this.apiBuffers = { face: [], ppg: [], resp: [] };

    this.els.statusText.textContent = 'Calibrating...';
    this.updateProgress(0);

    this.vitalLensInstance!.reset();
    this.vitalLensInstance!.setInferenceEnabled(true);
    this.startApiSession();
  }

  private triggerHardReset() {
    this.vitalLensInstance!.setInferenceEnabled(false);
    this.stopApiSession();

    this.vitalLensInstance!.reset();
    this.updateProgress(0);
    this.clearStatusTimeout();

    this.retryCount++;

    if (this.retryCount > CONFIG.MAX_RETRIES) {
      this.els.statusText.textContent = 'Face lost too many times.';
      this.updateStateUI(ScanState.FAILED);
    } else {
      this.updateStateUI(ScanState.FACE_LOST);
      this.els.statusText.textContent = 'Face lost';
      this.statusTimeout = window.setTimeout(() => {
        if (this.state === ScanState.FACE_LOST) {
          this.consecutiveFaceFrames = 0;
          this.updateStateUI(ScanState.DETECTING_FACE);
        }
      }, 2000);
    }
  }

  private triggerSoftReset(reason: string) {
    this.retryCount++;
    this.clearStatusTimeout();

    if (this.retryCount > CONFIG.MAX_RETRIES) {
      this.vitalLensInstance!.setInferenceEnabled(false);
      this.stopApiSession();
      this.els.statusText.textContent = 'Could not get clear reading.';
      this.updateStateUI(ScanState.FAILED);
    } else {
      if (DEBUG_MODE) console.warn(`[Soft Reset] ${reason}`);
      this.warmupStart = Date.now() / 1000;
      this.scanStart = null;

      this.els.statusText.textContent = reason + ' Restarting...';
      this.updateProgress(0);

      this.statusTimeout = window.setTimeout(() => {
        this.statusTimeout = null;
      }, 2000);
    }
  }

  private finishScan(result: VitalLensResult, requiredVitals: Vital[]) {
    const stats = this.getUsageStats();
    this.finalDurationStr = `${stats.seconds.toFixed(1)}s (≈${stats.frames}f)`;

    this.vitalLensInstance!.setInferenceEnabled(false);
    this.stopApiSession();
    this.vitalLensInstance!.stopVideoStream();
    this.stopCamera();

    const { vital_signs } = result;
    const allConfident = requiredVitals.every((v) => {
      const val = vital_signs[v];
      if (!val) return true;
      const conf = Array.isArray(val.confidence)
        ? (val.confidence.slice(-1)[0] ?? 0)
        : (val.confidence ?? 0);
      return conf >= CONFIG.FINAL_THRESHOLD;
    });

    if (!allConfident) {
      this.startFlow();
      this.els.statusText.textContent = 'Measurements uncertain. Retrying...';
      return;
    }

    this.renderResults(result);
    this.updateStateUI(ScanState.COMPLETE);
  }

  private resetFlow() {
    this.clearStatusTimeout();
    if (this.vitalLensInstance) this.vitalLensInstance.stopVideoStream();
    this.stopCamera();
    this.updateProgress(0);
    this.accumulatedApiTime = 0;
    this.currentApiSessionStart = null;
    this.updateStateUI(ScanState.IDLE);
  }

  // ===========================================================================
  // HELPERS & UI
  // ===========================================================================

  private getRequirements(modelName?: string): Vital[] {
    if (modelName?.includes('vitallens-2.0'))
      return ['heart_rate', 'respiratory_rate', 'hrv_sdnn', 'hrv_rmssd'];
    return ['heart_rate', 'respiratory_rate'];
  }

  private isFaceCentered(coords: number[]): boolean {
    const [x0, y0, x1, y1] = coords;
    const cx = (x0 + x1) / 2,
      cy = (y0 + y1) / 2;
    const video = this.els.video as HTMLVideoElement;
    const vw = video.videoWidth || 640,
      vh = video.videoHeight || 480;

    const mx = vw * 0.375;
    const my = vh * 0.375;

    return cx > mx && cx < vw - mx && cy > my && cy < vh - my;
  }

  private updateBuffer(buffer: number[], val: number, size: number): number {
    buffer.push(val);
    if (buffer.length > size) buffer.shift();
    return this.getAverage(buffer);
  }

  private getAverage(buffer: number[]): number {
    return buffer.length
      ? buffer.reduce((a, b) => a + b, 0) / buffer.length
      : 0;
  }

  private updateProgress(percent: number) {
    const offset = CIRCUMFERENCE - percent * CIRCUMFERENCE;
    this.els.progressRing.style.strokeDashoffset = offset.toString();
  }

  private clearStatusTimeout() {
    if (this.statusTimeout) {
      window.clearTimeout(this.statusTimeout);
      this.statusTimeout = null;
    }
  }

  private updateStateUI(newState: ScanState) {
    this.state = newState;
    const {
      startScreen,
      scanScene,
      resultCard,
      aperture,
      statusText,
      debugOverlay,
      stopButton,
      headerTitle,
    } = this.els;

    startScreen.classList.add('hidden');
    scanScene.classList.remove('visible');
    resultCard.classList.remove('visible');

    aperture.classList.remove('scanning');
    stopButton.classList.remove('visible');
    debugOverlay.classList.add('hidden');
    statusText.style.color = '#fff';

    headerTitle.classList.remove('visible');

    switch (newState) {
      case ScanState.IDLE:
        startScreen.classList.remove('hidden');
        headerTitle.classList.add('visible');
        break;

      case ScanState.DETECTING_FACE:
        scanScene.classList.add('visible');
        statusText.classList.add('visible');
        statusText.textContent = 'Looking for face...';
        stopButton.classList.add('visible');
        if (DEBUG_MODE) debugOverlay.classList.remove('hidden');
        break;

      case ScanState.SCANNING:
        scanScene.classList.add('visible');
        statusText.textContent = 'Scanning...';
        statusText.classList.add('visible');
        aperture.classList.add('scanning');
        stopButton.classList.add('visible');
        if (DEBUG_MODE) debugOverlay.classList.remove('hidden');
        break;

      case ScanState.FACE_LOST:
        scanScene.classList.add('visible');
        statusText.classList.add('visible');
        statusText.style.color = '#ff4444';
        stopButton.classList.add('visible');
        if (DEBUG_MODE) debugOverlay.classList.remove('hidden');
        break;

      case ScanState.COMPLETE:
        resultCard.classList.add('visible');
        headerTitle.classList.add('visible');
        break;

      case ScanState.FAILED:
        startScreen.classList.remove('hidden');
        headerTitle.classList.add('visible');
        this.els.startButton.textContent = 'Retry Scan';
        break;
    }

    if (newState === ScanState.IDLE) {
      this.els.startButton.textContent = 'Start Scan';
    }
  }

  private renderResults(result: VitalLensResult) {
    const vs = result.vital_signs;
    const fmt = (val: number | null | undefined) =>
      val !== null && val !== undefined ? val.toFixed(0) : '--';
    const pct = (val: number | null | undefined) =>
      ((val ?? 0) * 100).toFixed(0) + '%';

    const getConf = (val?: number | number[]) => 
      Array.isArray(val) ? (val[val.length - 1] ?? 0) : (val ?? 0);

    this.els.valHr.textContent = fmt(vs.heart_rate?.value);
    this.els.valRr.textContent = fmt(vs.respiratory_rate?.value);

    const sdnnConf = getConf(vs.hrv_sdnn?.confidence);
    const hasHrv = sdnnConf >= CONFIG.FINAL_THRESHOLD;

    this.els.hrvContainer.classList.toggle('hidden', !hasHrv);
    if (hasHrv) {
      this.els.valSdnn.textContent = fmt(vs.hrv_sdnn?.value);
      this.els.valRmssd.textContent = fmt(vs.hrv_rmssd?.value);
    }

    this.els.confHr.textContent = pct(getConf(vs.heart_rate?.confidence));
    this.els.confRr.textContent = pct(getConf(vs.respiratory_rate?.confidence));
    this.els.confSdnn.textContent = pct(getConf(vs.hrv_sdnn?.confidence));
    this.els.confRmssd.textContent = pct(getConf(vs.hrv_rmssd?.confidence));

    const faceConfs = result.face?.confidence || [];
    this.els.valFaceConf.textContent = pct(this.getAverage(faceConfs));

    this.els.valDuration.textContent = this.finalDurationStr;
  }

  private toggleDetails() {
    const rows = this.shadowRoot!.querySelectorAll('.conf-row');
    const isHidden = this.els.detailsSection.classList.contains('hidden');

    rows.forEach((el) => el.classList.toggle('hidden', !isHidden));
    this.els.detailsSection.classList.toggle('hidden', !isHidden);
    this.els.detailsButton.textContent = isHidden
      ? 'Hide Details'
      : 'View Details';
  }

  protected resetUI(): void {}
}

customElements.define('vitallens-vitals-scan', VitalLensVitalsScan);
