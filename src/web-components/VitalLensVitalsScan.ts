// FILE: src/web-components/VitalLensVitalsScan.ts
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

// Circumference of 240x320 oval (rx=115, ry=155) -> ~853
const CIRCUMFERENCE = 853;

export class VitalLensVitalsScan extends VitalLensWidgetBase {
  private state: ScanState = ScanState.IDLE;
  
  // Timers
  private warmupStartTime: number = 0;
  private scanStartTime: number | null = null;
  private lastFrameTime = 0;
  private lowConfidenceDuration = 0;

  private retryCount: number = 0;
  private readonly MAX_RETRIES = 2;
  private statusMessageTimeout: number | null = null;
  
  // Config
  private readonly FACE_GATE_FRAMES = 3; 
  private consecutiveFaceFrames = 0;
  
  // CHANGE: 3.33s Warmup + 30s Scan = ~33.3s total.
  // At 30fps this is ~1000 frames. At 15fps this is ~500 frames.
  private readonly WARMUP_DURATION = 3.33; 
  
  // Grace period starts AFTER warmup finishes.
  // Total "safe time" = WARMUP_DURATION + GRACE_PERIOD
  private readonly GRACE_PERIOD = 5.0; 
  private readonly LOW_CONFIDENCE_THRESHOLD_DURATION = 2.0;

  // UI Elements
  private startButton!: HTMLButtonElement;
  private restartButton!: HTMLButtonElement;
  private videoElement!: HTMLVideoElement;
  
  private aperture!: HTMLElement;
  private progressRing!: SVGPathElement;
  
  private statusText!: HTMLElement;
  private resultCard!: HTMLElement;
  private hrvContainer!: HTMLElement;
  
  private valHr!: HTMLElement;
  private valRr!: HTMLElement;
  private valSdnn!: HTMLElement;
  private valRmssd!: HTMLElement;

  constructor() {
    super();
    this.shadowRoot!.innerHTML = widget.replace(/__LOGO_URL__/g, logoUrl);
  }

  protected getElements(): void {
    this.startButton = this.shadowRoot!.querySelector('#btn-start')!;
    this.restartButton = this.shadowRoot!.querySelector('#btn-restart')!;
    this.videoElement = this.shadowRoot!.querySelector('#video')!;
    
    this.aperture = this.shadowRoot!.querySelector('#aperture')!;
    this.progressRing = this.shadowRoot!.querySelector('#progress-fg')!;
    this.statusText = this.shadowRoot!.querySelector('#status-text')!;
    
    this.resultCard = this.shadowRoot!.querySelector('#result-card')!;
    this.hrvContainer = this.shadowRoot!.querySelector('#hrv-container')!;
    
    this.valHr = this.shadowRoot!.querySelector('#val-hr')!;
    this.valRr = this.shadowRoot!.querySelector('#val-rr')!;
    this.valSdnn = this.shadowRoot!.querySelector('#val-sdnn')!;
    this.valRmssd = this.shadowRoot!.querySelector('#val-rmssd')!;
  }

  connectedCallback() {
    super.connectedCallback();
    this.startButton.addEventListener('click', () => this.startFlow());
    this.restartButton.addEventListener('click', () => this.resetFlow());
    this.updateStateUI(ScanState.IDLE);
  }

  protected async initVitalLensInstance(options: Partial<VitalLensOptions> = {}): Promise<void> {
    await super.initVitalLensInstance({
      ...options,
      method: 'vitallens', 
      overrideFpsTarget: 15,
      fDetFs: 1.0 
    });

    if (this.vitalLensInstance) {
      this.vitalLensInstance.addEventListener('faceDetected', (data: unknown) => {
        const faceData = data as { coordinates: number[], confidence: number } | null;
        this.handleRawFace(faceData);
      });
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
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false 
      });
      
      this.videoElement.srcObject = stream;
      await this.vitalLensInstance!.setVideoStream(stream, this.videoElement);
      
      this.vitalLensInstance!.setInferenceEnabled(false);
      this.vitalLensInstance!.startVideoStream();
      
    } catch (e) {
      console.error(e);
      this.showError("Could not access camera.");
      this.updateStateUI(ScanState.IDLE);
    }
  }

  private resetFlow() {
    if (this.statusMessageTimeout) {
        window.clearTimeout(this.statusMessageTimeout);
        this.statusMessageTimeout = null;
    }

    if (this.vitalLensInstance) {
        this.vitalLensInstance.stopVideoStream();
    }
    if (this.videoElement.srcObject) {
        (this.videoElement.srcObject as MediaStream).getTracks().forEach(t => t.stop());
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
      faceCx > xMargin && faceCx < (vw - xMargin) &&
      faceCy > yMargin && faceCy < (vh - yMargin)
    );
  }

  private handleRawFace(face: { coordinates: number[], confidence: number } | null) {
    if (this.state !== ScanState.DETECTING_FACE) return;

    let message = "Position face in oval";
    let validFrame = false;

    if (face) {
      const isCentered = this.isFaceCentered(face.coordinates);
      
      if (face.confidence < 0.5) {
        message = "Face not clear";
      } else if (!isCentered) {
        message = "Center your face";
      } else {
        message = "Hold still...";
        validFrame = true;
      }
    }

    this.statusText.textContent = message;

    if (validFrame) {
      this.consecutiveFaceFrames++;
    } else {
      this.consecutiveFaceFrames = 0;
    }

    if (this.consecutiveFaceFrames >= this.FACE_GATE_FRAMES) {
      console.log('[VitalLensScan] Gate passed. Starting Scan.');
      this.beginScanning();
    }
  }

  private beginScanning() {
    this.updateStateUI(ScanState.SCANNING);
    
    this.warmupStartTime = Date.now() / 1000;
    this.scanStartTime = null; 
    this.lastFrameTime = this.warmupStartTime;
    this.lowConfidenceDuration = 0;
    
    this.statusText.textContent = "Calibrating...";
    
    this.vitalLensInstance!.reset();
    this.vitalLensInstance!.setInferenceEnabled(true); 
  }

  protected updateUI(result: VitalLensResult): void {
    if (this.state !== ScanState.SCANNING) return;

    const now = Date.now() / 1000;
    const dt = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // === WARMUP PHASE (3.33s) ===
    // We stay here for 3.33s. Progress is 0. Confidence ignored.
    if (!this.scanStartTime) {
        const warmupElapsed = now - this.warmupStartTime;
        if (warmupElapsed < this.WARMUP_DURATION) {
            this.updateProgress(0);
            if (this.statusText.textContent !== "Calibrating...") {
               this.statusText.textContent = "Calibrating...";
            }
            return;
        } else {
            // Warmup done. Start the actual scan timer.
            this.scanStartTime = now;
            this.statusText.textContent = "Scanning...";
        }
    }

    // === SCANNING PHASE (30s) ===
    const elapsed = now - this.scanStartTime;
    const faceConf = result.face?.confidence?.[0] ?? 0;

    // Robustness Check:
    // Ignored for the first 5s (GRACE_PERIOD) of the actual scan.
    if (elapsed > this.GRACE_PERIOD) {
        if (faceConf < 0.6) {
            this.lowConfidenceDuration += dt;
        } else {
            this.lowConfidenceDuration = Math.max(0, this.lowConfidenceDuration - dt);
        }

        if (this.lowConfidenceDuration > this.LOW_CONFIDENCE_THRESHOLD_DURATION) {
            console.warn('[Scan Loop] Reset triggered due to low confidence.');
            this.handleScanIssue("Face lost or lighting poor.");
            return;
        }
    }

    // Progress calculation
    const modelName = result.model_used || 'vitallens-2.0'; 
    const reqKey = Object.keys(MODEL_REQUIREMENTS).find(k => modelName.includes(k)) || 'default';
    const reqs = MODEL_REQUIREMENTS[reqKey];

    const progress = Math.min(elapsed / reqs.minDuration, 1.0);
    this.updateProgress(progress);

    // Completion Logic
    if (elapsed >= reqs.minDuration) {
      const hasVitals = reqs.requiredVitals.every(v => {
        const val = result.vital_signs[v];
        if (val && 'value' in val) {
          const confidence = val.confidence ?? 0;
          const threshold = v.includes('hrv') ? 0.3 : 0.5; 
          return val.value !== null && confidence > threshold;
        }
        return false;
      });

      if (hasVitals) {
        this.finishScan(result);
      } else if (elapsed > reqs.minDuration + 5) {
         this.handleScanIssue("Could not gather high confidence data.");
      }
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
      this.statusText.textContent = reason;
      this.updateStateUI(ScanState.FAILED);
    } else {
      this.statusText.textContent = "Hold still... restarting.";
      
      this.statusMessageTimeout = window.setTimeout(() => {
          if (this.state === ScanState.SCANNING) {
              this.statusText.textContent = "Scanning...";
          }
          this.statusMessageTimeout = null;
      }, 5000);

      // Restart the whole flow (including warmup)
      this.beginScanning();
    }
  }

  private finishScan(result: VitalLensResult) {
    this.vitalLensInstance!.setInferenceEnabled(false);
    this.vitalLensInstance!.stopVideoStream();
    
    this.valHr.textContent = result.vital_signs.heart_rate?.value?.toFixed(0) ?? '--';
    this.valRr.textContent = result.vital_signs.respiratory_rate?.value?.toFixed(0) ?? '--';
    
    const hasHrv = result.vital_signs.hrv_sdnn?.value != null;
    if (hasHrv) {
        this.hrvContainer.classList.remove('hidden');
        this.valSdnn.textContent = result.vital_signs.hrv_sdnn?.value?.toFixed(0) ?? '--';
        this.valRmssd.textContent = result.vital_signs.hrv_rmssd?.value?.toFixed(0) ?? '--';
    } else {
        this.hrvContainer.classList.add('hidden');
    }

    this.updateStateUI(ScanState.COMPLETE);
  }

  private updateProgress(percent: number) {
    const offset = CIRCUMFERENCE - (percent * CIRCUMFERENCE);
    this.progressRing.style.strokeDashoffset = offset.toString();
  }

  private updateStateUI(newState: ScanState) {
    this.state = newState;
    
    this.startButton.classList.add('hidden');
    this.aperture.classList.remove('scanning');
    this.resultCard.classList.remove('visible');
    this.statusText.classList.remove('visible');
    this.statusText.style.color = '#fff';

    switch (newState) {
      case ScanState.IDLE:
        this.startButton.classList.remove('hidden');
        break;

      case ScanState.DETECTING_FACE:
        this.statusText.classList.add('visible');
        break;

      case ScanState.SCANNING:
        this.statusText.textContent = "Scanning...";
        this.statusText.classList.add('visible');
        this.aperture.classList.add('scanning');
        break;

      case ScanState.COMPLETE:
        this.resultCard.classList.add('visible');
        break;

      case ScanState.FAILED:
        this.statusText.classList.add('visible');
        this.statusText.style.color = '#ff4444';
        this.startButton.textContent = "Retry";
        this.startButton.classList.remove('hidden');
        break;
    }
  }

  protected resetUI(): void {}
}

customElements.define('vitallens-vitals-scan', VitalLensVitalsScan);