import { VitalLensWidgetBase } from './VitalLensWidgetBase';
import { VitalLensOptions, VitalLensResult } from '../types';
import widget from './vitals-monitor.html';
import logoUrl from '../../assets/logo.svg';

const VITAL_CONFIDENCE_THRESHOLD = 0.7; // Confidence threshold for showing a vital sign
const HRV_CONFIDENCE_THRESHOLD = 0.5; // Confidence threshold for showing hrv
const FACE_CONFIDENCE_THRESHOLD = 0.5; // Confidence threshold for considering a face tracked

class VitalLensVitalsMonitor extends VitalLensWidgetBase {
  private statusIndicator!: HTMLElement;
  private hrValueElement!: HTMLElement;
  private rrValueElement!: HTMLElement;
  private hrvSdnnElement!: HTMLElement;
  private hrvRmssdElement!: HTMLElement;
  private promptElement!: HTMLElement;
  private feedbackMessageElement!: HTMLElement;
  private vitalsGridElement!: HTMLElement;

  // Spinner elements
  private hrSpinner!: HTMLElement;
  private rrSpinner!: HTMLElement;
  private hrvSdnnSpinner!: HTMLElement;
  private hrvRmssdSpinner!: HTMLElement;

  private ecoMode = false;
  private mediaStream: MediaStream | null = null;

  constructor() {
    super();
    this.shadowRoot!.innerHTML = widget.replace('__LOGO_URL__', logoUrl);
  }

  connectedCallback() {
    super.connectedCallback();
    this.ecoMode = this.hasAttribute('eco-mode');
    this.addEventListener('click', this.toggleProcessing);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('click', this.toggleProcessing);
  }

  protected getElements(): void {
    this.statusIndicator = this.shadowRoot!.querySelector('#status-indicator')!;
    this.hrValueElement = this.shadowRoot!.querySelector('#hr-value')!;
    this.rrValueElement = this.shadowRoot!.querySelector('#rr-value')!;
    this.hrvSdnnElement = this.shadowRoot!.querySelector('#hrv-sdnn')!;
    this.hrvRmssdElement = this.shadowRoot!.querySelector('#hrv-rmssd')!;
    this.promptElement = this.shadowRoot!.querySelector('#prompt')!;
    this.feedbackMessageElement =
      this.shadowRoot!.querySelector('#feedback-message')!;
    this.vitalsGridElement = this.shadowRoot!.querySelector('#vitals-grid')!;

    // Get spinners
    this.hrSpinner = this.shadowRoot!.querySelector('#hr-spinner')!;
    this.rrSpinner = this.shadowRoot!.querySelector('#rr-spinner')!;
    this.hrvSdnnSpinner = this.shadowRoot!.querySelector('#hrv-sdnn-spinner')!;
    this.hrvRmssdSpinner =
      this.shadowRoot!.querySelector('#hrv-rmssd-spinner')!;
  }

  protected async initVitalLensInstance(): Promise<void> {
    const options: Partial<VitalLensOptions> = {
      ...(this.ecoMode && { overrideFpsTarget: 15 }),
    };
    await super.initVitalLensInstance(options);
  }

  private async toggleProcessing(): Promise<void> {
    if (!this.vitalLensInstance) {
      await this.initVitalLensInstance();
    }

    this.isProcessingFlag = !this.isProcessingFlag;

    if (this.isProcessingFlag) {
      this.promptElement.style.display = 'none';
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true,
        });
        await this.vitalLensInstance!.setVideoStream(this.mediaStream);
        this.vitalLensInstance!.startVideoStream();
        this.statusIndicator.className = 'status-indicator status-searching';

        // **FIX:** Display initial instructions immediately.
        this.vitalsGridElement.style.display = 'none';
        this.feedbackMessageElement.textContent =
          'Face the camera, ensure good lighting and hold still.';
        this.feedbackMessageElement.style.display = 'block';
      } catch (err) {
        console.error('Failed to start webcam:', err);
        this.showError('Could not access webcam.');
        this.isProcessingFlag = false;
        this.resetUI();
      }
    } else {
      this.vitalLensInstance!.stopVideoStream();
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach((track) => track.stop());
        this.mediaStream = null;
      }
      this.resetUI();
    }
  }

  private updateVitalDisplay(
    vital: keyof VitalLensResult['vital_signs'],
    result: VitalLensResult,
    valueEl: HTMLElement,
    spinnerEl: HTMLElement,
    confThresh: number,
    toFixed: number
  ): boolean {
    const vitalData = result.vital_signs[vital];

    if (!vitalData || !('value' in vitalData)) {
      valueEl.style.display = 'none';
      spinnerEl.style.display = 'inline-block';
      return false;
    }

    const confidence = vitalData.confidence ?? 0;

    if (confidence >= confThresh && vitalData.value !== null) {
      valueEl.style.display = 'inline';
      spinnerEl.style.display = 'none';
      valueEl.textContent = vitalData.value.toFixed(toFixed);
      return true; // High confidence
    } else {
      valueEl.style.display = 'none';
      spinnerEl.style.display = 'inline-block';
      return false; // Low confidence
    }
  }

  protected updateUI(result: VitalLensResult): void {
    const { heart_rate, respiratory_rate, hrv_sdnn } = result.vital_signs;
    const debugLog = {
      timestamp: new Date().toLocaleTimeString(),
      faceConfidence:
        result.face?.confidence?.[result.face.confidence.length - 1]?.toFixed(
          4
        ) ?? 'N/A',
      hr: heart_rate?.value?.toFixed(1) ?? 'N/A',
      hrConfidence: heart_rate?.confidence?.toFixed(4) ?? 'N/A',
      rr: respiratory_rate?.value?.toFixed(1) ?? 'N/A',
      rrConfidence: respiratory_rate?.confidence?.toFixed(4) ?? 'N/A',
      sdnn: hrv_sdnn?.value?.toFixed(1) ?? 'N/A',
      sdnnConfidence: hrv_sdnn?.confidence?.toFixed(4) ?? 'N/A',
    };
    console.log('VitalLens Monitor Debug:', debugLog);

    const { face } = result;
    const faceConfidence = face?.confidence?.[face.confidence.length - 1] ?? 0;

    // Default to showing vitals and hiding the message
    this.vitalsGridElement.style.display = 'flex';
    this.feedbackMessageElement.style.display = 'none';

    if (faceConfidence < FACE_CONFIDENCE_THRESHOLD) {
      this.statusIndicator.className = 'status-indicator status-lost';
      this.vitalsGridElement.style.display = 'none'; // Hide vitals grid
      this.feedbackMessageElement.textContent =
        'Face the camera and hold still';
      this.feedbackMessageElement.style.display = 'block'; // Show message
      return;
    }

    this.statusIndicator.className = 'status-indicator status-tracking';

    const hasConfidentHr = this.updateVitalDisplay(
      'heart_rate',
      result,
      this.hrValueElement,
      this.hrSpinner,
      VITAL_CONFIDENCE_THRESHOLD,
      0
    );
    const hasConfidentRr = this.updateVitalDisplay(
      'respiratory_rate',
      result,
      this.rrValueElement,
      this.rrSpinner,
      VITAL_CONFIDENCE_THRESHOLD,
      0
    );

    let hasConfidentHrv = false;
    if (this.supportedVitals.some((v) => v.startsWith('hrv_'))) {
      const hasSdnn = this.updateVitalDisplay(
        'hrv_sdnn',
        result,
        this.hrvSdnnElement,
        this.hrvSdnnSpinner,
        HRV_CONFIDENCE_THRESHOLD,
        1
      );
      const hasRmssd = this.updateVitalDisplay(
        'hrv_rmssd',
        result,
        this.hrvRmssdElement,
        this.hrvRmssdSpinner,
        HRV_CONFIDENCE_THRESHOLD,
        1
      );
      hasConfidentHrv = hasSdnn || hasRmssd;
    }

    const allVitalsLowConfidence = !(
      hasConfidentHr ||
      hasConfidentRr ||
      hasConfidentHrv
    );

    if (allVitalsLowConfidence) {
      this.vitalsGridElement.style.display = 'none'; // Hide vitals grid
      this.feedbackMessageElement.textContent =
        'Low confidence. Ensure you are well lit and hold still.';
      this.feedbackMessageElement.style.display = 'block'; // Show message
    }
  }

  protected resetUI(): void {
    this.promptElement.style.display = 'flex';
    this.statusIndicator.className = 'status-indicator status-idle';

    this.vitalsGridElement.style.display = 'flex';
    this.feedbackMessageElement.style.display = 'none';

    this.hrValueElement.textContent = '--';
    this.rrValueElement.textContent = '--';
    this.hrvSdnnElement.textContent = '--';
    this.hrvRmssdElement.textContent = '--';

    [
      this.hrSpinner,
      this.rrSpinner,
      this.hrvSdnnSpinner,
      this.hrvRmssdSpinner,
    ].forEach((el) => (el ? (el.style.display = 'none') : null));
    [
      this.hrValueElement,
      this.rrValueElement,
      this.hrvSdnnElement,
      this.hrvRmssdElement,
    ].forEach((el) => (el ? (el.style.display = 'inline') : null));
  }
}

customElements.define('vitallens-vitals-monitor', VitalLensVitalsMonitor);
