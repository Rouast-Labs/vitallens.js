import { VitalLensBase, SessionState } from './VitalLensBase';
import { VitalLensResult } from '../types';
import { VitalMetadataCache } from '../utils/VitalMetadataCache';
import template from './monitor.html';
import logoUrl from '../../assets/logo.svg';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
} from 'chart.js';
import { WaveformPlayer } from './WaveformPlayer';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale
);

export class VitalLensMonitor extends VitalLensBase {
  private state: SessionState = 'idle';
  private currentMode: 'eco' | 'standard' = 'eco';

  private videoEl!: HTMLVideoElement;
  private startScreen!: HTMLElement;
  private cameraLayer!: HTMLElement;
  private bottomPanel!: HTMLElement;
  private messageEl!: HTMLElement;
  private statusBadge!: HTMLElement;
  private statusText!: HTMLElement;

  // Waveform elements
  private ppgCanvas!: HTMLCanvasElement;
  private ppgSpinner!: HTMLElement;
  private respCanvas!: HTMLCanvasElement;
  private respSpinner!: HTMLElement;

  private waveformPlayer: WaveformPlayer;
  private ppgChart!: Chart;
  private respChart!: Chart;

  private ppgSampleCount = 0;
  private receivedVitals: Set<string> = new Set();
  private stream: MediaStream | null = null;
  private isFaceCurrentlyDetected = false;

  private ppgConfHistory: number[] = [];
  private respConfHistory: number[] = [];
  private faceConfHistory: number[] = [];

  constructor() {
    super();
    this.shadowRoot!.innerHTML = template;

    this.waveformPlayer = new WaveformPlayer(
      (ppgHistory, ppgConfHist, respHistory, respConfHist) => {
        this.updateChart(this.ppgChart, ppgHistory);
        this.updateChart(this.respChart, respHistory);
        this.ppgConfHistory = ppgConfHist;
        this.respConfHistory = respConfHist;
        this.evaluateChartReadiness();
      },
      0.15,
      8.0,
      15
    );
  }

  connectedCallback() {
    super.connectedCallback();
    this.shadowRoot!.querySelector<HTMLImageElement>('#logo')!.src = logoUrl;

    this.ppgChart = this.createChart('#ppgCanvas', '#E62100');
    this.respChart = this.createChart('#respCanvas', '#00A3FC');

    this.startScreen.addEventListener('start', () => this.startProcessing());
    this.startScreen.addEventListener('modechange', (e: Event) => {
      this.currentMode = (e as CustomEvent).detail.mode;
    });

    this.shadowRoot!.querySelector('#stopBtn')!.addEventListener('click', () =>
      this.stopProcessing()
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopProcessing();
  }

  protected getElements(): void {
    this.videoEl = this.shadowRoot!.querySelector('#video')!;
    this.startScreen = this.shadowRoot!.querySelector('#startScreen')!;
    this.cameraLayer = this.shadowRoot!.querySelector('#cameraLayer')!;
    this.bottomPanel = this.shadowRoot!.querySelector('#bottomPanel')!;
    this.messageEl = this.shadowRoot!.querySelector('#messageEl')!;
    this.statusBadge = this.shadowRoot!.querySelector('#statusBadge')!;
    this.statusText = this.shadowRoot!.querySelector('#statusText')!;

    this.ppgCanvas = this.shadowRoot!.querySelector('#ppgCanvas')!;
    this.ppgSpinner = this.shadowRoot!.querySelector('#ppgSpinner')!;
    this.respCanvas = this.shadowRoot!.querySelector('#respCanvas')!;
    this.respSpinner = this.shadowRoot!.querySelector('#respSpinner')!;
  }

  private async startProcessing() {
    this.isProcessingFlag = true;
    this.startScreen.style.display = 'none';
    this.cameraLayer.style.display = 'block';

    this.bottomPanel.classList.add('visible');
    this.transitionState('searching', 'Face the camera and hold still.');

    const fps = this.currentMode === 'eco' ? 15 : 30;
    this.waveformPlayer.setFps(fps);

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user' },
      });
      this.videoEl.srcObject = this.stream;

      await this.initVitalLensInstance({ overrideFpsTarget: fps });

      this.configureVitalMeta();

      this.vitalLensInstance!.addEventListener(
        'faceDetected',
        (face: unknown) => {
          const isPresent = face !== null;
          if (!this.isProcessingFlag) return;

          this.isFaceCurrentlyDetected = isPresent;
          if (!isPresent) {
            // Changed to gracefully fallback to searching instead of fatal issue
            this.transitionState(
              'searching',
              'Face the camera and hold still.'
            );
            this.vitalLensInstance?.reset();
            this.clearMeasurements();
          } else if (this.state === 'searching' || this.state === 'idle') {
            this.transitionState('searching', 'Face detected, analyzing...');
          }
        }
      );

      await this.vitalLensInstance!.setVideoStream(this.stream, this.videoEl);
      this.vitalLensInstance!.startVideoStream();
    } catch (e) {
      console.error(e);
      const errorMsg = e instanceof Error ? e.message : String(e);
      this.stopProcessing();
      if (errorMsg.includes('API Key') || errorMsg.includes('VitalLensAPI')) {
        this.showError(errorMsg);
      } else {
        this.showError('Could not access camera. Please check permissions.');
      }
    }
  }

  private stopProcessing() {
    this.isProcessingFlag = false;
    this.vitalLensInstance?.stopVideoStream();
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.startScreen.style.display = 'block';
    this.cameraLayer.style.display = 'none';
    this.bottomPanel.classList.remove('visible');
    this.transitionState('idle', '');
    this.clearMeasurements();
  }

  protected updateUI(result: VitalLensResult): void {
    if (!this.isProcessingFlag || !this.isFaceCurrentlyDetected) return;

    for (const key of Object.keys(result.vitals)) {
      this.receivedVitals.add(key);
    }

    this.updateHRVDisplay();

    // Maintain a brief history of face confidences
    if (result.face?.confidence) {
      this.faceConfHistory.push(...result.face.confidence);
      // Cap memory usage (keep roughly 2 seconds)
      const fps = this.currentMode === 'eco' ? 15 : 30;
      if (this.faceConfHistory.length > fps * 2) {
        this.faceConfHistory = this.faceConfHistory.slice(-Math.round(fps * 2));
      }
    }

    this.waveformPlayer.addData(result);

    if (result.time) {
      this.ppgSampleCount += result.time.length;
    }

    const { heart_rate, respiratory_rate, hrv_sdnn, hrv_rmssd } = result.vitals;
    const getConf = (v: { confidence?: number | number[] } | undefined) =>
      Array.isArray(v?.confidence)
        ? v.confidence[v.confidence.length - 1]
        : (v?.confidence ?? 0);

    const hrConf = getConf(heart_rate);
    const rrConf = getConf(respiratory_rate);
    const sdnnConf = getConf(hrv_sdnn);
    const rmssdConf = getConf(hrv_rmssd);

    this.updateValue(
      'hrVal',
      heart_rate?.value,
      hrConf >= this.VITAL_CONF_THRESHOLD,
      0
    );
    this.updateValue(
      'rrVal',
      respiratory_rate?.value,
      rrConf >= this.VITAL_CONF_THRESHOLD,
      0
    );
    this.updateValue(
      'sdnnVal',
      hrv_sdnn?.value,
      sdnnConf >= this.HRV_CONF_THRESHOLD,
      1
    );
    this.updateValue(
      'rmssdVal',
      hrv_rmssd?.value,
      rmssdConf >= this.HRV_CONF_THRESHOLD,
      1
    );

    // Let the shared state machine evaluate our situation
    const fps = this.currentMode === 'eco' ? 15 : 30;
    const requiredSamples = 6.0 * fps;
    const hasEnoughData = this.ppgSampleCount >= requiredSamples;

    const feedback = this.resolveFeedbackState(
      this.state,
      result,
      this.faceConfHistory,
      this.ppgConfHistory,
      fps,
      this.videoEl.videoWidth,
      this.videoEl.videoHeight,
      hasEnoughData
    );

    this.transitionState(feedback.state, feedback.message);
  }

  // Determines if waveforms should be shown based on average confidence & minimum data
  private evaluateChartReadiness() {
    const fps = this.currentMode === 'eco' ? 15 : 30;
    const requiredSamples = 6.0 * fps;
    const hasEnoughData = this.ppgSampleCount >= requiredSamples;

    const avgPpgConf = this.ppgConfHistory.length
      ? this.ppgConfHistory.reduce((a, b) => a + b, 0) /
        this.ppgConfHistory.length
      : 0;
    const avgRespConf = this.respConfHistory.length
      ? this.respConfHistory.reduce((a, b) => a + b, 0) /
        this.respConfHistory.length
      : 0;

    const isPpgReady = hasEnoughData && avgPpgConf >= this.VITAL_CONF_THRESHOLD;
    const isRespReady =
      hasEnoughData && avgRespConf >= this.VITAL_CONF_THRESHOLD;

    this.ppgCanvas.style.display = isPpgReady ? 'block' : 'none';
    this.ppgSpinner.style.display = isPpgReady ? 'none' : 'block';

    this.respCanvas.style.display = isRespReady ? 'block' : 'none';
    this.respSpinner.style.display = isRespReady ? 'none' : 'block';
  }

  private transitionState(newState: SessionState, msg: string) {
    if (this.state !== newState) {
      this.statusBadge.className = `status-badge status-${newState}`;
      const stateLabels: Record<SessionState, string> = {
        idle: 'Idle',
        searching: 'Searching',
        warmingUp: 'Calibrating',
        tracking: 'Tracking',
        recovering: 'Recovering',
        issue: 'Issue',
        completed: 'Done',
      };
      this.statusText.textContent = stateLabels[newState];
      this.state = newState;
    }

    if (this.state === 'warmingUp') {
      const fps = this.currentMode === 'eco' ? 15 : 30;
      const requiredSamples = 6.0 * fps;
      const prog = Math.min(
        100,
        Math.round((this.ppgSampleCount / requiredSamples) * 100)
      );
      this.messageEl.textContent = `Calibrating signals... (${prog}%)`;
    } else {
      this.messageEl.textContent = msg;
    }
  }

  private clearMeasurements() {
    this.waveformPlayer.reset();
    this.ppgSampleCount = 0;
    this.receivedVitals.clear();
    this.ppgConfHistory = [];
    this.respConfHistory = [];
    this.faceConfHistory = []; // Ensure this clears

    this.updateChart(this.ppgChart, []);
    this.updateChart(this.respChart, []);
    this.evaluateChartReadiness();

    this.updateValue('hrVal', null, false, 0);
    this.updateValue('rrVal', null, false, 0);
    this.updateValue('sdnnVal', null, false, 1);
    this.updateValue('rmssdVal', null, false, 1);
  }

  protected updateHRVDisplay(): void {
    const hasHrv =
      this.receivedVitals.has('hrv_sdnn') ||
      this.receivedVitals.has('hrv_rmssd');
    this.shadowRoot!.querySelector<HTMLElement>(
      '#hrvContainer'
    )!.style.display = hasHrv ? 'flex' : 'none';
    this.shadowRoot!.querySelector<HTMLElement>('#hrBox')!.classList.toggle(
      'wide',
      hasHrv
    );
  }

  private configureVitalMeta() {
    // HR
    const hrMeta = VitalMetadataCache.getMeta('heart_rate');
    if (hrMeta) {
      this.shadowRoot!.querySelector('#hrTitle')!.textContent =
        hrMeta.shortName || hrMeta.short_name || 'HR';
      this.shadowRoot!.querySelector('#hrUnit')!.textContent = (
        hrMeta.unit || 'BPM'
      ).toUpperCase();
    }

    // RR
    const rrMeta = VitalMetadataCache.getMeta('respiratory_rate');
    if (rrMeta) {
      this.shadowRoot!.querySelector('#rrTitle')!.textContent =
        rrMeta.shortName || rrMeta.short_name || 'RR';
      this.shadowRoot!.querySelector('#rrUnit')!.textContent = (
        rrMeta.unit || 'RPM'
      ).toUpperCase();
    }

    // SDNN
    const sdnnMeta = VitalMetadataCache.getMeta('hrv_sdnn');
    if (sdnnMeta) {
      this.shadowRoot!.querySelector('#sdnnTitle')!.textContent =
        sdnnMeta.shortName || sdnnMeta.short_name || 'SDNN';
      this.shadowRoot!.querySelector('#sdnnUnit')!.textContent = (
        sdnnMeta.unit || 'ms'
      ).toLowerCase();
    }

    // RMSSD
    const rmssdMeta = VitalMetadataCache.getMeta('hrv_rmssd');
    if (rmssdMeta) {
      this.shadowRoot!.querySelector('#rmssdTitle')!.textContent =
        rmssdMeta.shortName || rmssdMeta.short_name || 'RMSSD';
      this.shadowRoot!.querySelector('#rmssdUnit')!.textContent = (
        rmssdMeta.unit || 'ms'
      ).toLowerCase();
    }

    // PPG Chart
    const ppgMeta = VitalMetadataCache.getMeta('ppg_waveform');
    if (ppgMeta) {
      this.shadowRoot!.querySelector('#ppgChartLabel')!.textContent =
        ppgMeta.display_name || ppgMeta.displayName || 'PPG Waveform';
      this.ppgChart.data.datasets[0].borderColor = ppgMeta.color || '#E62100';
      this.ppgChart.update();
    }

    // RESP Chart
    const respMeta = VitalMetadataCache.getMeta('respiratory_waveform');
    if (respMeta) {
      this.shadowRoot!.querySelector('#respChartLabel')!.textContent =
        respMeta.display_name || respMeta.displayName || 'Respiratory Waveform';
      this.respChart.data.datasets[0].borderColor = respMeta.color || '#00A3FC';
      this.respChart.update();
    }
  }

  private updateValue(
    id: string,
    val: number | null | undefined,
    isReady: boolean,
    decimals: number
  ) {
    const el = this.shadowRoot!.getElementById(id);
    if (!el) return;
    if (val != null && isReady) {
      el.textContent = val.toFixed(decimals);
      el.classList.remove('unready');
    } else {
      el.textContent = '--';
      el.classList.add('unready');
    }
  }

  private createChart(selector: string, color: string) {
    const colorStr = color.startsWith('#') ? color : `rgba(${color}, 1)`;
    const ctx =
      this.shadowRoot!.querySelector<HTMLCanvasElement>(selector)!.getContext(
        '2d'
      )!;
    return new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            data: [],
            borderColor: colorStr,
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        animation: false,
        scales: { x: { display: false }, y: { display: false } },
      },
    });
  }

  private updateChart(chart: Chart, data: number[]) {
    // Generate exactly enough labels for the current data length.
    // Chart.js will automatically stretch these to fill the chart horizontally.
    chart.data.labels = Array.from({ length: data.length }, (_, i) => i);
    chart.data.datasets[0].data = data;
    chart.update();
  }

  protected resetUI(): void {
    this.stopProcessing();
  }
}

const register = (tagName: string, klass: CustomElementConstructor) => {
  if (!customElements.get(tagName)) {
    customElements.define(tagName, klass);
  }
};

try {
  register('vitallens-monitor', VitalLensMonitor);
  register('vitallens-vitals-monitor', VitalLensMonitor);
} catch {
  // Silent: Probably duplicate registration
}
