import { VitalLensBase } from './VitalLensBase';
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

type MonitorState = 'idle' | 'searching' | 'warmingUp' | 'tracking' | 'issue';

export class VitalLensMonitor extends VitalLensBase {
  private state: MonitorState = 'idle';
  private currentMode: 'eco' | 'standard' = 'eco';

  private videoEl!: HTMLVideoElement;
  private canvasEl!: HTMLCanvasElement;
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
  private ppgChart: any;
  private respChart: any;

  private readonly VITAL_CONF_THRESHOLD = 0.8;
  private readonly HRV_CONF_THRESHOLD = 0.7;
  private readonly FACE_CONF_THRESHOLD = 0.5;
  private readonly MIN_DISPLAY_SAMPLES = 6.0 * 15; // Minimum samples required before showing charts TODO make depending on display mode (fps)

  private ppgSampleCount = 0;
  private receivedVitals: Set<string> = new Set();
  private stream: MediaStream | null = null;
  private isFaceCurrentlyDetected = false;

  private ppgConfHistory: number[] = [];
  private respConfHistory: number[] = [];

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

    this.ppgChart = this.createChart('#ppgCanvas', '#e62300');  
    this.respChart = this.createChart('#respCanvas', '#007bff');  

    this.startScreen.addEventListener('start', () => this.startProcessing());
    this.startScreen.addEventListener('modechange', (e: any) => {
      this.currentMode = e.detail.mode;
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
    this.canvasEl = this.shadowRoot!.querySelector('#canvas')!;
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

    // Bottom panel is always visible during processing
    this.bottomPanel.classList.add('visible');
    this.transitionState(
      'searching',
      'Face the camera, ensure good lighting and hold still.'
    );

    const fps = this.currentMode === 'eco' ? 15 : 30;
    this.waveformPlayer.setFps(fps);

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user' },
      });
      this.videoEl.srcObject = this.stream;
      this.videoEl.onloadeddata = () => this.resizeCanvas();

      await this.initVitalLensInstance({ overrideFpsTarget: fps });

      this.configureVitalMeta();

      this.vitalLensInstance!.addEventListener('faceDetected', (face: any) => {
        const isPresent = face !== null;
        if (!this.isProcessingFlag) return;

        this.isFaceCurrentlyDetected = isPresent;
        if (!isPresent) {
          this.transitionState(
            'issue',
            'Check Position: Face the camera and hold still.'
          );
          this.vitalLensInstance?.reset();
          this.clearMeasurements();
        } else if (this.state === 'issue' || this.state === 'idle') {
          this.transitionState('searching', 'Face detected, analyzing...');
        }
      });

      await this.vitalLensInstance!.setVideoStream(this.stream, this.videoEl);
      this.vitalLensInstance!.startVideoStream();
    } catch (e) {
      console.error(e);
      this.showError('Could not access camera.');
      this.stopProcessing();
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

    const faceConfs = result.face.confidence ?? [];
    const currentFaceConf =
      faceConfs.length > 0 ? faceConfs[faceConfs.length - 1] : 0.0;

    if (currentFaceConf < this.FACE_CONF_THRESHOLD) {
      this.transitionState('issue', 'Face not clear. Hold still.');
      this.canvasEl
        .getContext('2d')!
        .clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);
      return;
    }

    if (result.face.coordinates && result.face.coordinates.length > 0) {
      this.drawFaceBox(
        result.face.coordinates[result.face.coordinates.length - 1]
      );
    }

    this.waveformPlayer.addData(result);

    // Track sample count for warming up phase
    if (result.time) {
      this.ppgSampleCount += result.time.length;
    }

    const vs = result.vitals;
    const getConf = (v: any) =>
      Array.isArray(v?.confidence)
        ? v.confidence[v.confidence.length - 1]
        : (v?.confidence ?? 0);

    const hrConf = getConf(vs.heart_rate);
    const rrConf = getConf(vs.respiratory_rate);
    const sdnnConf = getConf(vs.hrv_sdnn);
    const rmssdConf = getConf(vs.hrv_rmssd);

    // Update Vitals UI mirroring iOS: show value if ready, otherwise -- with unready class
    this.updateValue(
      'hrVal',
      vs.heart_rate?.value,
      hrConf >= this.VITAL_CONF_THRESHOLD,
      0
    );
    this.updateValue(
      'rrVal',
      vs.respiratory_rate?.value,
      rrConf >= this.VITAL_CONF_THRESHOLD,
      0
    );
    this.updateValue(
      'sdnnVal',
      vs.hrv_sdnn?.value,
      sdnnConf >= this.HRV_CONF_THRESHOLD,
      1
    );
    this.updateValue(
      'rmssdVal',
      vs.hrv_rmssd?.value,
      rmssdConf >= this.HRV_CONF_THRESHOLD,
      1
    );

    const hasConfidentHr = hrConf >= this.VITAL_CONF_THRESHOLD;
    const hasConfidentRr = rrConf >= this.VITAL_CONF_THRESHOLD;
    const hasConfidentHrv =
      sdnnConf >= this.HRV_CONF_THRESHOLD ||
      rmssdConf >= this.HRV_CONF_THRESHOLD;

    const fps = this.currentMode === 'eco' ? 15 : 30;
    const requiredSamples = 6.0 * fps;
    const hasEnoughData = this.ppgSampleCount >= requiredSamples;

    if (!(hasConfidentHr || hasConfidentRr || hasConfidentHrv)) {
      this.transitionState(
        'issue',
        'Low confidence. Ensure you are well lit and hold still.'
      );
    } else if (!hasEnoughData) {
      const prog = Math.min(
        100,
        Math.round((this.ppgSampleCount / requiredSamples) * 100)
      );
      this.transitionState('warmingUp', `Calibrating signals... (${prog}%)`);
    } else {
      this.transitionState('tracking', 'Tracking vitals');
    }
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

  private transitionState(newState: MonitorState, msg: string) {
    if (this.state !== newState) {
      this.statusBadge.className = `status-badge status-${newState}`;
      const stateLabels: Record<MonitorState, string> = {
        idle: 'Idle',
        searching: 'Searching...',
        warmingUp: 'Calibrating...',
        tracking: 'Tracking',
        issue: 'Check Position',
      };
      this.statusText.textContent = stateLabels[newState];
      this.state = newState;
    }

    this.messageEl.textContent = msg;
  }

  private clearMeasurements() {
    this.waveformPlayer.reset();
    this.ppgSampleCount = 0;
    this.receivedVitals.clear();
    this.ppgConfHistory = [];
    this.respConfHistory = [];

    this.updateChart(this.ppgChart, []);
    this.updateChart(this.respChart, []);
    this.evaluateChartReadiness(); // Reset to spinner state

    this.updateValue('hrVal', null, false, 0);
    this.updateValue('rrVal', null, false, 0);
    this.updateValue('sdnnVal', null, false, 1);
    this.updateValue('rmssdVal', null, false, 1);
    this.canvasEl
      .getContext('2d')!
      .clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);
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
      this.shadowRoot!.querySelector('#hrTitle')!.textContent = hrMeta.shortName || hrMeta.short_name || 'HR';
      this.shadowRoot!.querySelector('#hrUnit')!.textContent = (hrMeta.unit || 'BPM').toUpperCase();
    }

    // RR
    const rrMeta = VitalMetadataCache.getMeta('respiratory_rate');
    if (rrMeta) {
      this.shadowRoot!.querySelector('#rrTitle')!.textContent = rrMeta.shortName || rrMeta.short_name || 'RR';
      this.shadowRoot!.querySelector('#rrUnit')!.textContent = (rrMeta.unit || 'RPM').toUpperCase();
    }

    // SDNN
    const sdnnMeta = VitalMetadataCache.getMeta('hrv_sdnn');
    if (sdnnMeta) {
      this.shadowRoot!.querySelector('#sdnnTitle')!.textContent = sdnnMeta.shortName || sdnnMeta.short_name || 'SDNN';
      this.shadowRoot!.querySelector('#sdnnUnit')!.textContent = (sdnnMeta.unit || 'ms').toLowerCase();
    }

    // RMSSD
    const rmssdMeta = VitalMetadataCache.getMeta('hrv_rmssd');
    if (rmssdMeta) {
      this.shadowRoot!.querySelector('#rmssdTitle')!.textContent = rmssdMeta.shortName || rmssdMeta.short_name || 'RMSSD';
      this.shadowRoot!.querySelector('#rmssdUnit')!.textContent = (rmssdMeta.unit || 'ms').toLowerCase();
    }

    // PPG Chart
    const ppgMeta = VitalMetadataCache.getMeta('ppg_waveform');
    if (ppgMeta) {
      this.shadowRoot!.querySelector('#ppgChartLabel')!.textContent = ppgMeta.display_name || ppgMeta.displayName || 'PPG Waveform';
      this.ppgChart.data.datasets[0].borderColor = ppgMeta.color || '#e62300';
      this.ppgChart.update();
    }

    // RESP Chart
    const respMeta = VitalMetadataCache.getMeta('respiratory_waveform');
    if (respMeta) {
      this.shadowRoot!.querySelector('#respChartLabel')!.textContent = respMeta.display_name || respMeta.displayName || 'Respiratory Waveform';
      this.respChart.data.datasets[0].borderColor = respMeta.color || '#007bff';
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

  private updateChart(chart: any, data: number[]) {
    // Generate exactly enough labels for the current data length.
    // Chart.js will automatically stretch these to fill the chart horizontally.
    chart.data.labels = Array.from({ length: data.length }, (_, i) => i);
    chart.data.datasets[0].data = data;
    chart.update();
  }

  private resizeCanvas() {
    const rect = this.videoEl.getBoundingClientRect();
    this.canvasEl.width = rect.width;
    this.canvasEl.height = rect.height;
  }

  private drawFaceBox(roi: number[]) {
    const ctx = this.canvasEl.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);
    const [x0, y0, x1, y1] = roi;

    const vw = this.videoEl.videoWidth,
      vh = this.videoEl.videoHeight;
    const cw = this.canvasEl.width,
      ch = this.canvasEl.height;
    const vRatio = vw / vh;
    const cRatio = cw / ch;

    let drawW,
      drawH,
      offX = 0,
      offY = 0;
    if (vRatio > cRatio) {
      drawH = ch;
      drawW = ch * vRatio;
      offX = (cw - drawW) / 2;
    } else {
      drawW = cw;
      drawH = cw / vRatio;
      offY = (ch - drawH) / 2;
    }

    // Multiply absolute coordinates by the scale factor
    const scaleX = drawW / vw;
    const scaleY = drawH / vh;
    
    const boxX = cw - (offX + x1 * scaleX);
    const boxY = offY + y0 * scaleY;
    const boxW = (x1 - x0) * scaleX;
    const boxH = (y1 - y0) * scaleY;

    ctx.strokeStyle = 'rgba(70, 163, 219, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(boxX, boxY, boxW, boxH);
  }

  protected resetUI(): void {
    this.stopProcessing();
  }
}

try {
  if (!customElements.get('vitallens-monitor')) {
    customElements.define('vitallens-monitor', VitalLensMonitor);
  }
} catch (e) {
  console.warn('vitallens-monitor registration bypassed');
}
// if (!customElements.get('vitallens-vitals-monitor')) {
//   customElements.define('vitallens-vitals-monitor', VitalLensMonitor);
// }
