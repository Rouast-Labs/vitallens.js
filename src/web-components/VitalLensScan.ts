import { VitalLensBase } from './VitalLensBase';
import { VitalLensResult } from '../types';
import { VitalMetadataCache } from '../utils/VitalMetadataCache';
import template from './scan.html';
import logoUrl from '../../assets/logo.svg';

type ScanState = 'idle' | 'searching' | 'warmingUp' | 'tracking' | 'recovering' | 'issue' | 'completed';

export class VitalLensScan extends VitalLensBase {
  private state: ScanState = 'idle';
  private currentMode: 'eco' | 'standard' = 'eco';
  
  private videoEl!: HTMLVideoElement;
  private startScreen!: HTMLElement;
  private resultScreen!: any; // Reference to the vitallens-result component
  private cameraLayer!: HTMLElement;
  private messageEl!: HTMLElement;
  private statusBadge!: HTMLElement;
  private statusText!: HTMLElement;
  private progressFg!: SVGPathElement;
  private apertureWrapper!: HTMLElement;
  
  private readonly VITAL_CONF_THRESHOLD = 0.8;
  private readonly HRV_CONF_THRESHOLD = 0.7;
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
  private isFaceCurrentlyDetected = false;

  constructor() {
    super();
    this.shadowRoot!.innerHTML = template;
  }

  connectedCallback() {
    super.connectedCallback();
    this.shadowRoot!.querySelector<HTMLImageElement>('#logo')!.src = logoUrl;
    
    this.startScreen.addEventListener('start', () => this.startProcessing());
    this.startScreen.addEventListener('modechange', (e: any) => {
      this.currentMode = e.detail.mode;
    });

    this.shadowRoot!.querySelector('#stopBtn')!.addEventListener('click', () => this.resetToIdle());
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
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user' } });
      this.videoEl.srcObject = this.stream;
      
      await this.initVitalLensInstance({ overrideFpsTarget: fps, waveformMode: 'incremental' });
      
      this.vitalLensInstance!.addEventListener('faceDetected', (face: any) => {
        const isPresent = face !== null;
        if (!this.isProcessingFlag) return;
        
        this.isFaceCurrentlyDetected = isPresent;
        if (!isPresent && this.state !== 'searching' && this.state !== 'issue' && this.state !== 'completed') {
          this.handleIssue('Face lost.');
        }
      });
      
      await this.vitalLensInstance!.setVideoStream(this.stream, this.videoEl);
      this.vitalLensInstance!.startVideoStream();
      
    } catch (e) {
      console.error(e);
      this.showError('Could not access camera.');
      this.resetToIdle();
    }
  }

  private stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
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

  private transitionState(newState: ScanState, msg: string) {
    if (this.state !== newState) {
      this.statusBadge.className = `status-badge status-${newState}`;
      const stateLabels: Record<ScanState, string> = {
        idle: 'Idle', searching: 'Searching...', warmingUp: 'Calibrating...', 
        tracking: 'Scanning', recovering: 'Adjust Position', issue: 'Issue', completed: 'Done'
      };
      this.statusText.textContent = stateLabels[newState];
      this.state = newState;
      this.stateStartTime = performance.now() / 1000;
      this.lastFrameTime = performance.now() / 1000;
      
      this.apertureWrapper.classList.toggle('is-scanning', newState === 'tracking' || newState === 'recovering');
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

  private isFaceGood(result: VitalLensResult): boolean {
    if (!result.face || !result.face.coordinates || result.face.coordinates.length === 0) return false;
    
    const vw = this.videoEl.videoWidth;
    const vh = this.videoEl.videoHeight;
    if (!vw || !vh) return false;

    const coords = result.face.coordinates[result.face.coordinates.length - 1];
    const [x0, y0, x1, y1] = coords;
    
    // Normalize coordinates based on video dimensions
    const cx = ((x0 + x1) / 2) / vw;
    const cy = ((y0 + y1) / 2) / vh;
    const w = (x1 - x0) / vw;
    
    return cx > 0.3 && cx < 0.7 && cy > 0.3 && cy < 0.7 && w > 0.15;
  }

  protected updateUI(result: VitalLensResult): void {
    if (!this.isProcessingFlag || this.state === 'idle' || this.state === 'completed' || this.state === 'issue') return;

    const framesInThisUpdate = result.time ? result.time.length : 1;
    this.totalFramesProcessed += framesInThisUpdate;

    if (result.face?.confidence) this.faceConfHistory.push(...result.face.confidence);
    
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
    const samplesInOneSecond = Math.round(fps);

    const lastSecFaceConf = this.faceConfHistory.slice(-samplesInOneSecond);
    const avgFaceConfLastSec = lastSecFaceConf.length ? lastSecFaceConf.reduce((a, b) => a + b, 0) / lastSecFaceConf.length : 0.0;

    const lastSecPpgConf = this.ppgConfHistory.slice(-samplesInOneSecond);
    const avgPpgConfLastSec = lastSecPpgConf.length ? lastSecPpgConf.reduce((a, b) => a + b, 0) / lastSecPpgConf.length : 0.0;

    const isLowSignal = avgPpgConfLastSec < 0.5 || avgFaceConfLastSec < 0.5;
    const goodFace = this.isFaceGood(result);

    const now = performance.now() / 1000;
    const elapsedInState = now - this.stateStartTime;

    if (this.state === 'tracking' || this.state === 'recovering') {
      this.accumulatedScanTime += (now - this.lastFrameTime);
      this.updateProgress(Math.min(this.accumulatedScanTime / this.SCAN_DURATION, 1.0));
      
      if (this.accumulatedScanTime >= this.SCAN_DURATION) {
        this.finishScan(result);
        return;
      }
    }
    this.lastFrameTime = now;

    switch (this.state) {
      case 'searching':
        if (goodFace) this.transitionState('warmingUp', 'Calibrating... Hold still.');
        break;
      case 'warmingUp':
        if (elapsedInState >= this.WARM_UP_DURATION) this.transitionState('tracking', 'Scanning...');
        break;
      case 'tracking':
        if (!goodFace) this.transitionState('recovering', 'Adjust position...');
        else if (isLowSignal) this.transitionState('recovering', 'Improve lighting...');
        break;
      case 'recovering':
        if (goodFace && !isLowSignal) {
          this.transitionState('tracking', 'Scanning...');
        } else if (elapsedInState >= this.RECOVERY_TIMEOUT) {
          this.handleIssue('Could not recover conditions.');
        } else {
          const issueMsg = !goodFace ? 'Adjust position...' : 'Improve lighting...';
          if (this.messageEl.textContent !== issueMsg) this.messageEl.textContent = issueMsg;
        }
        break;
    }
  }

  private finishScan(result: VitalLensResult) {
    this.isProcessingFlag = false;
    this.vitalLensInstance?.stopVideoStream();
    this.stopCamera();

    this.transitionState('completed', '');
    this.cameraLayer.style.display = 'none';
    this.resultScreen.style.display = 'block';

    const avgFace = this.faceConfHistory.length ? this.faceConfHistory.reduce((a, b) => a + b, 0) / this.faceConfHistory.length : 0;
    const duration = this.totalFramesProcessed / (result.fps ?? (this.currentMode === 'eco' ? 15 : 30));

    const vs = result.vitals;
    const getConf = (v: any) => Array.isArray(v?.confidence) ? v.confidence[v.confidence.length - 1] : (v?.confidence ?? 0);

    const hrConf = getConf(vs.heart_rate);
    const rrConf = getConf(vs.respiratory_rate);
    const sdnnConf = getConf(vs.hrv_sdnn);
    const rmssdConf = getConf(vs.hrv_rmssd);

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
      buildVital('heart_rate', hrConf >= this.VITAL_CONF_THRESHOLD ? vs.heart_rate?.value : null, hrConf, '%.0f', false),
      buildVital('respiratory_rate', rrConf >= this.VITAL_CONF_THRESHOLD ? vs.respiratory_rate?.value : null, rrConf, '%.0f', false)
    ].filter(Boolean) as any[];

    const secondaryVitals = [
      buildVital('hrv_sdnn', sdnnConf >= this.HRV_CONF_THRESHOLD ? vs.hrv_sdnn?.value : null, sdnnConf, '%.0f', true),
      buildVital('hrv_rmssd', rmssdConf >= this.HRV_CONF_THRESHOLD ? vs.hrv_rmssd?.value : null, rmssdConf, '%.0f', true)
    ].filter(Boolean) as any[];

    this.resultScreen.resultData = {
      primaryVitals,
      secondaryVitals,
      stats: { duration, sampleCount: this.totalFramesProcessed, avgFaceConf: avgFace },
      ppgWaveform: this.ppgHistory,
      respWaveform: this.respHistory
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
try {
  if (!customElements.get('vitallens-scan')) {
    customElements.define('vitallens-scan', VitalLensScan);
  }
} catch (e) {
  console.warn('vitallens-scan registration bypassed');
}
// if (!customElements.get('vitallens-vitals-scan')) {
//   customElements.define('vitallens-vitals-scan', VitalLensScan);
// }