import { VitalLensBase, SessionState } from './VitalLensBase';
import { Method, VitalLensOptions, VitalLensResult } from '../types';
import widget from './widget.html';
import logoUrl from '../../assets/logo.svg';
import {
  Chart,
  CategoryScale,
  LinearScale,
  LineController,
  PointElement,
  LineElement,
} from 'chart.js';
import { WaveformPlayer } from './WaveformPlayer';
import { VitalMetadataCache } from '../utils/VitalMetadataCache';

const playbackDotPlugin = {
  id: 'playbackDot',
  afterDatasetsDraw(
    chart: Chart,
    _args: { cancelable: boolean },
    options: {
      xValue?: number;
      radius?: number;
      lineWidth?: number;
      strokeStyle?: string;
    }
  ) {
    const ctx = chart.ctx;
    const markerIndex = options.xValue;
    if (markerIndex === undefined || markerIndex === null) return;

    const datasetMeta = chart.getDatasetMeta(0);
    if (!datasetMeta || !datasetMeta.data || datasetMeta.data.length === 0)
      return;

    const index = Math.round(markerIndex);
    if (index < 0 || index >= datasetMeta.data.length) return;

    const point = datasetMeta.data[index] as unknown as {
      x: number;
      y: number;
    };
    if (!point) return;

    const xPixel = point.x;
    const yPixel = point.y;

    const radius = options.radius || 4;
    ctx.save();
    ctx.beginPath();
    ctx.arc(xPixel, yPixel, radius, 0, 2 * Math.PI);
    ctx.fillStyle = chart.data.datasets[0].borderColor as string;
    ctx.fill();
    ctx.lineWidth = options.lineWidth || 2;
    ctx.strokeStyle = options.strokeStyle || 'white';
    ctx.stroke();
    ctx.restore();
  },
};

const overlayTitlePlugin = {
  id: 'overlayTitle',
  afterDraw(
    chart: Chart,
    args: unknown,
    options: { text: string; font?: string; color?: string }
  ) {
    if (!options || !options.text) return;
    const ctx = chart.ctx;
    const chartArea = chart.chartArea;
    if (!chartArea) return;
    ctx.save();
    ctx.font = options.font || 'bold 16px sans-serif';
    const text = options.text || '';
    const textWidth = ctx.measureText(text).width;
    const textHeight = 16;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(chartArea.left, chartArea.top, textWidth + 8, textHeight + 8);
    ctx.fillStyle = options.color || 'white';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(options.text || '', chartArea.left, chartArea.top + 8);
    ctx.restore();
  },
};

Chart.register(
  CategoryScale,
  LineController,
  LinearScale,
  PointElement,
  LineElement,
  playbackDotPlugin,
  overlayTitlePlugin
);

export class VitalLensWidget extends VitalLensBase {
  protected videoElement!: HTMLVideoElement;
  protected canvasElement!: HTMLCanvasElement;
  protected dropZoneElement!: HTMLElement;
  protected videoInputElement!: HTMLInputElement;
  protected videoDimmerElement!: HTMLElement;
  protected videoSpinnerElement!: HTMLElement;
  protected videoProgressElement!: HTMLElement;
  protected webcamModeButtonElement!: HTMLButtonElement;
  protected fileModeButtonElement!: HTMLButtonElement;
  protected controlButtonElement!: HTMLButtonElement;
  protected methodSelectElement!: HTMLSelectElement;
  protected fpsValueElement!: HTMLElement;
  protected downloadButtonElement!: HTMLButtonElement;
  protected vitalsDimmerElement!: HTMLElement;
  protected vitalsSpinnerElement!: HTMLElement;
  protected vitalsProgressElement!: HTMLElement;
  protected errorPopupElement!: HTMLElement;

  protected charts: Record<string, Chart> = {};
  protected videoFileLoaded: File | null = null;
  protected currentMethod: Method = 'vitallens';
  protected mode: string = '';
  protected debug: boolean = false;
  protected readonly ecoModeFps: number = 15;
  protected bufferingTimeout: number | null = null;
  private _handleResizeBound = this.handleResize.bind(this);

  private waveformPlayer: WaveformPlayer;

  protected readonly WINDOW_SIZE = 8.0;

  protected sessionState: SessionState = 'idle';
  protected faceConfHistory: number[] = [];
  protected ppgConfHistory: number[] = [];
  protected ppgSampleCount: number = 0;
  protected displayPpgData: number[] = [];
  protected displayPpgConf: number[] = [];
  protected displayRespData: number[] = [];
  protected displayRespConf: number[] = [];

  constructor() {
    super();
    this.shadowRoot!.innerHTML = widget.replace('__LOGO_URL__', logoUrl);
    this.waveformPlayer = new WaveformPlayer(
      (ppgHistory, ppgConfHistory, respHistory, respConfHistory) => {
        this.displayPpgData = ppgHistory;
        this.displayPpgConf = ppgConfHistory;
        this.displayRespData = respHistory;
        this.displayRespConf = respConfHistory;

        const isReady = this.sessionState === 'tracking';
        this.updateChart(this.charts.ppgChart, isReady ? ppgHistory : []);
        this.updateChart(this.charts.respChart, isReady ? respHistory : []);
      },
      0.15,
      this.WINDOW_SIZE,
      this.ecoModeFps
    );
  }

  connectedCallback() {
    super.connectedCallback();
    this.charts.ppgChart = this.createChart(
      'ppgChart',
      'PPG Waveform',
      '#e62300'
    );
    this.charts.respChart = this.createChart(
      'respChart',
      'Respiratory Waveform',
      '#007bff'
    );
    this.bindEvents();
    window.addEventListener('resize', this._handleResizeBound);

    this.startMode('webcam', true, false).catch((err) =>
      console.error('Failed to start webcam mode:', err)
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('resize', this._handleResizeBound);
    this.waveformPlayer.stop();
  }

  protected getElements(): void {
    this.videoElement = this.shadowRoot!.querySelector('#video')!;
    this.canvasElement = this.shadowRoot!.querySelector('#canvas')!;
    this.dropZoneElement = this.shadowRoot!.querySelector('#dropZone')!;
    this.videoInputElement = this.shadowRoot!.querySelector('#videoInput')!;
    this.videoDimmerElement = this.shadowRoot!.querySelector('#videoDimmer')!;
    this.videoSpinnerElement = this.shadowRoot!.querySelector('#videoSpinner')!;
    this.videoProgressElement = this.shadowRoot!.querySelector(
      '#videoProgressMessage'
    )!;
    this.webcamModeButtonElement =
      this.shadowRoot!.querySelector('#webcamModeButton')!;
    this.fileModeButtonElement =
      this.shadowRoot!.querySelector('#fileModeButton')!;
    this.controlButtonElement =
      this.shadowRoot!.querySelector('#controlButton')!;
    this.methodSelectElement = this.shadowRoot!.querySelector('#methodSelect')!;
    this.fpsValueElement = this.shadowRoot!.querySelector(
      '#fpsDisplay .fps-value'
    )!;
    this.downloadButtonElement =
      this.shadowRoot!.querySelector('#downloadButton')!;
    this.vitalsDimmerElement = this.shadowRoot!.querySelector('#vitalsDimmer')!;
    this.vitalsSpinnerElement =
      this.shadowRoot!.querySelector('#vitalsSpinner')!;
    this.vitalsProgressElement = this.shadowRoot!.querySelector(
      '#vitalsProgressMessage'
    )!;
    this.errorPopupElement = this.shadowRoot!.querySelector('#errorPopup')!;
  }

  // Update initVitalLensInstance to trigger the metadata sync
  protected async initVitalLensInstance(): Promise<void> {
    const selectedMethod =
      (this.methodSelectElement.value as Method) || 'vitallens';
    if (this.vitalLensInstance && this.currentMethod === selectedMethod) return;

    this.currentMethod = selectedMethod;
    this.waveformPlayer.setFps(this.ecoModeFps);

    const options: Partial<VitalLensOptions> = {
      method: this.currentMethod,
      overrideFpsTarget: this.ecoModeFps,
      waveformMode: this.mode === 'webcam' ? 'incremental' : 'global',
    };

    await super.initVitalLensInstance(options);
    this.configureVitalMeta();

    if (this.vitalLensInstance) {
      this.vitalLensInstance.addEventListener('fileProgress', (e) =>
        this.handleVideoProgressEvent(e as string)
      );
    }
  }

  // Add this new method
  private configureVitalMeta() {
    const hrMeta = VitalMetadataCache.getMeta('heart_rate');
    if (hrMeta) {
      const el = this.shadowRoot!.querySelector('#ppgStats .label');
      if (el)
        el.innerHTML = `${hrMeta.short_name || hrMeta.shortName || 'HR'} <span class="unit">${(hrMeta.unit || 'bpm').toLowerCase()}</span>`;
    }

    const rrMeta = VitalMetadataCache.getMeta('respiratory_rate');
    if (rrMeta) {
      const el = this.shadowRoot!.querySelector('#respStats .label');
      if (el)
        el.innerHTML = `${rrMeta.short_name || rrMeta.shortName || 'RR'} <span class="unit">${(rrMeta.unit || 'bpm').toLowerCase()}</span>`;
    }

    const sdnnMeta = VitalMetadataCache.getMeta('hrv_sdnn');
    if (sdnnMeta) {
      const el = this.shadowRoot!.querySelector(
        '.hrv-stat:nth-child(1) .hrv-label'
      );
      if (el)
        el.textContent = sdnnMeta.short_name || sdnnMeta.shortName || 'SDNN';
      const unitEl = this.shadowRoot!.querySelector(
        '.hrv-stat:nth-child(1) .hrv-unit'
      );
      if (unitEl) unitEl.textContent = (sdnnMeta.unit || 'ms').toLowerCase();
    }

    const rmssdMeta = VitalMetadataCache.getMeta('hrv_rmssd');
    if (rmssdMeta) {
      const el = this.shadowRoot!.querySelector(
        '.hrv-stat:nth-child(2) .hrv-label'
      );
      if (el)
        el.textContent = rmssdMeta.short_name || rmssdMeta.shortName || 'RMSSD';
      const unitEl = this.shadowRoot!.querySelector(
        '.hrv-stat:nth-child(2) .hrv-unit'
      );
      if (unitEl) unitEl.textContent = (rmssdMeta.unit || 'ms').toLowerCase();
    }

    const ppgMeta = VitalMetadataCache.getMeta('ppg_waveform');
    if (ppgMeta && this.charts.ppgChart) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const plugins = this.charts.ppgChart.options.plugins as any;
      plugins.overlayTitle.text =
        ppgMeta.display_name || ppgMeta.displayName || 'PPG Waveform';
      plugins.overlayTitle.color = ppgMeta.color || '#e62300';
      this.charts.ppgChart.data.datasets[0].borderColor =
        ppgMeta.color || '#e62300';
      if (plugins.playbackDot) {
        plugins.playbackDot.strokeStyle = ppgMeta.color || '#e62300';
      }
      this.charts.ppgChart.update();
      this.style.setProperty('--ppg-color', ppgMeta.color || '#e62300');
    }

    const respMeta = VitalMetadataCache.getMeta('respiratory_waveform');
    if (respMeta && this.charts.respChart) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const plugins = this.charts.respChart.options.plugins as any;
      plugins.overlayTitle.text =
        respMeta.display_name || respMeta.displayName || 'Respiratory Waveform';
      plugins.overlayTitle.color = respMeta.color || '#007bff';
      this.charts.respChart.data.datasets[0].borderColor =
        respMeta.color || '#007bff';
      if (plugins.playbackDot) {
        plugins.playbackDot.strokeStyle = respMeta.color || '#007bff';
      }
      this.charts.respChart.update();
      this.style.setProperty('--resp-color', respMeta.color || '#007bff');
    }
  }

  protected updateUI(result: VitalLensResult): void {
    this.clearBufferingTimeout();
    const { face, vitals, waveforms, fps } = result;

    if (this.mode === 'webcam') {
      const currentFps = this.ecoModeFps;

      // Track face and PPG confidence history
      if (face?.confidence) {
        this.faceConfHistory.push(...face.confidence);
        if (this.faceConfHistory.length > currentFps * 2) {
          this.faceConfHistory = this.faceConfHistory.slice(
            -Math.round(currentFps * 2)
          );
        }
      }
      if (waveforms?.ppg_waveform?.confidence) {
        const c = waveforms.ppg_waveform.confidence;
        this.ppgConfHistory.push(...(Array.isArray(c) ? c : [c]));
        if (this.ppgConfHistory.length > currentFps * 2) {
          this.ppgConfHistory = this.ppgConfHistory.slice(
            -Math.round(currentFps * 2)
          );
        }
      }
      if (result.time) {
        this.ppgSampleCount += result.time.length;
      }

      const hasEnoughData = this.ppgSampleCount >= 6.0 * currentFps; // 6 seconds

      // Ask the base class to evaluate the data
      const feedback = this.resolveFeedbackState(
        this.sessionState,
        result,
        this.faceConfHistory,
        this.ppgConfHistory,
        currentFps,
        this.videoElement.videoWidth,
        this.videoElement.videoHeight,
        hasEnoughData
      );

      this.sessionState = feedback.state;

      // Show loader and hide graphics if not successfully tracking
      if (this.sessionState !== 'tracking') {
        let msg = feedback.message;
        if (this.sessionState === 'warmingUp') {
          const prog = Math.min(
            100,
            Math.round((this.ppgSampleCount / (6.0 * currentFps)) * 100)
          );
          msg = `Calibrating signals... (${prog}%)`;
        }
        this.showVitalsLoader(msg);
        this.canvasElement
          .getContext('2d')!
          .clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
      } else {
        this.hideVitalsLoader();
        if (face?.coordinates && face.coordinates.length > 0) {
          this.drawFaceBoxForRoi(face.coordinates[face.coordinates.length - 1]);
        }
      }

      this.waveformPlayer.addData(result);
    } else {
      // File mode ignores real-time states and renders the entire payload
      this.hideVitalsLoader();
      if (face?.coordinates && face.coordinates.length > 0) {
        this.drawFaceBoxForRoi(face.coordinates[face.coordinates.length - 1]);
      }
      this.updateChart(
        this.charts.ppgChart,
        waveforms.ppg_waveform?.data || []
      );
      this.updateChart(
        this.charts.respChart,
        waveforms.respiratory_waveform?.data || []
      );
    }

    const { heart_rate, respiratory_rate, hrv_sdnn, hrv_rmssd } = vitals;
    const getConf = (v: { confidence?: number | number[] } | undefined) =>
      Array.isArray(v?.confidence)
        ? v.confidence[v.confidence.length - 1]
        : (v?.confidence ?? 0);

    // Numeric values naturally handle their own threshold masking (-- if low confidence)
    this.updateNumericValue(
      'hr-value',
      heart_rate?.value,
      getConf(heart_rate),
      this.VITAL_CONF_THRESHOLD,
      0
    );
    this.updateNumericValue(
      'rr-value',
      respiratory_rate?.value,
      getConf(respiratory_rate),
      this.VITAL_CONF_THRESHOLD,
      0
    );
    this.updateNumericValue(
      'hrv-sdnn',
      hrv_sdnn?.value,
      getConf(hrv_sdnn),
      this.HRV_CONF_THRESHOLD,
      1
    );
    this.updateNumericValue(
      'hrv-rmssd',
      hrv_rmssd?.value,
      getConf(hrv_rmssd),
      this.HRV_CONF_THRESHOLD,
      1
    );

    this.updateFpsValue(fps);

    if (this.mode === 'webcam') this.setBufferingTimeout();
  }

  protected resetUI(): void {
    this.waveformPlayer.reset();

    this.sessionState = 'idle';
    this.faceConfHistory = [];
    this.ppgConfHistory = [];
    this.ppgSampleCount = 0;
    this.hideVitalsLoader();

    this.updateChart(this.charts.ppgChart, []);
    this.updateChart(this.charts.respChart, []);

    this.updateNumericValue('hr-value', undefined);
    this.updateNumericValue('rr-value', undefined);
    this.updateNumericValue('hrv-sdnn', undefined);
    this.updateNumericValue('hrv-rmssd', undefined);
    this.updateFpsValue(0);
  }

  protected createChart(elementId: string, label: string, baseColor: string) {
    const colorStr = baseColor.startsWith('#')
      ? baseColor
      : `rgba(${baseColor},1)`;
    const ctx = (
      this.shadowRoot!.querySelector(`#${elementId}`) as HTMLCanvasElement
    ).getContext('2d');
    const chart = new Chart(ctx!, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label,
            data: [],
            borderColor: colorStr,
            borderWidth: 2,
            tension: 0,
            pointRadius: 0,
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
    (chart.options.plugins as Record<string, unknown>).overlayTitle = {
      text: label,
      font: 'bold 16px sans-serif',
      color: colorStr,
    };
    return chart;
  }

  private updateChart(chart: Chart, data: number[]) {
    chart.data.labels = Array.from({ length: data.length }, (_, i) => i);
    chart.data.datasets[0].data = data;
    chart.update();
  }

  private updateNumericValue(
    elementId: string,
    value: number | null | undefined,
    confidence: number = 1.0,
    threshold: number = 0.0,
    toFixed = 0
  ): void {
    const element = this.shadowRoot?.querySelector(
      `#${elementId}`
    ) as HTMLElement | null;
    if (!element) return;

    if (value !== null && value !== undefined && confidence >= threshold) {
      element.textContent = value.toFixed(toFixed);
    } else {
      element.textContent = '--';
    }
  }

  private setCanvasDimensions() {
    if (!this.canvasElement) return;
    const rect = this.canvasElement.getBoundingClientRect();
    this.canvasElement.width = rect.width;
    this.canvasElement.height = rect.height;
  }

  private drawFaceBoxForRoi(roi: [number, number, number, number]) {
    if (this.debug) {
      const ctx = this.canvasElement.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
      const [x0, y0, x1, y1] = roi;
      const w = x1 - x0,
        h = y1 - y0;
      const videoWidth = this.videoElement.videoWidth,
        videoHeight = this.videoElement.videoHeight;
      const containerWidth = this.canvasElement.width,
        containerHeight = this.canvasElement.height;
      const videoAspect = videoWidth / videoHeight;
      const containerAspect = containerWidth / containerHeight;
      let displayedVideoWidth: number,
        displayedVideoHeight: number,
        offsetX: number,
        offsetY: number;
      if (videoAspect > containerAspect) {
        displayedVideoWidth = containerWidth;
        displayedVideoHeight = containerWidth / videoAspect;
        offsetX = 0;
        offsetY = (containerHeight - displayedVideoHeight) / 2;
      } else {
        displayedVideoHeight = containerHeight;
        displayedVideoWidth = containerHeight * videoAspect;
        offsetX = (containerWidth - displayedVideoWidth) / 2;
        offsetY = 0;
      }
      const scaleX = displayedVideoWidth / videoWidth;
      const scaleY = displayedVideoHeight / videoHeight;
      const boxX = offsetX + x0 * scaleX;
      const boxY = offsetY + y0 * scaleY;
      const boxW = w * scaleX;
      const boxH = h * scaleY;
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(boxX, boxY, boxW, boxH);
    }
  }

  private updateFpsValue(fps: number | undefined) {
    this.fpsValueElement.textContent = fps ? fps.toFixed(1) : 'N/A';
  }

  private async setupWebcam() {
    if (!this.vitalLensInstance) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user' },
      });
      this.videoElement.srcObject = stream;
      await this.vitalLensInstance.setVideoStream(stream, this.videoElement);
      this.videoElement.onloadeddata = () => {
        this.setCanvasDimensions();
        this.videoElement.play();
      };
    } catch (e) {
      console.error(e);
      this.showError('Could not access webcam. Please check permissions.');
    }
  }

  private enablePlaybackDotPlugin() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ppgPlugins = this.charts.ppgChart.options.plugins as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const respPlugins = this.charts.respChart.options.plugins as any;

    ppgPlugins.playbackDot = {
      xValue: 0,
      radius: 4,
      lineWidth: 2,
      strokeStyle: 'white',
    };
    respPlugins.playbackDot = {
      xValue: 0,
      radius: 4,
      lineWidth: 2,
      strokeStyle: 'white',
    };
    this.charts.ppgChart.update();
    this.charts.respChart.update();
  }

  private disablePlaybackDotPlugin() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ppgPlugins = this.charts.ppgChart.options.plugins as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const respPlugins = this.charts.respChart.options.plugins as any;

    if (ppgPlugins.playbackDot) delete ppgPlugins.playbackDot;
    if (respPlugins.playbackDot) delete respPlugins.playbackDot;

    this.charts.ppgChart.update();
    this.charts.respChart.update();
  }

  private async loadAndProcessFile(file: File) {
    this.dropZoneElement.style.display = 'none';
    this.showVideoLoader('');
    this.videoElement.style.display = 'block';
    this.canvasElement.style.display = 'block';
    const url = URL.createObjectURL(file);
    this.videoElement.src = url;
    this.videoElement.load();
    this.videoElement.onloadeddata = async () => {
      this.videoFileLoaded = file;
      this.setCanvasDimensions();
      this.videoElement.pause();
      if (!this.vitalLensInstance) await this.initVitalLensInstance();
      await this.processFile(file);
      this.hideVideoLoader();
      this.videoElement.controls = true;
    };
  }

  private async processFile(file: File) {
    if (!this.vitalLensInstance) return;
    try {
      const result = await this.vitalLensInstance.processVideoFile(file);
      this.enablePlaybackDotPlugin();
      this.updateUI(result);
    } catch (e) {
      console.error(e);
      this.showError((e as Error).message);
    }
  }

  protected async startMode(
    modeToStart: string,
    initUI: boolean,
    restartVitalLens: boolean
  ) {
    this.mode = modeToStart;
    if (!this.vitalLensInstance || restartVitalLens) {
      await this.initVitalLensInstance();
    }
    if (initUI) {
      if (modeToStart === 'webcam') this.setupWebcamUI();
      else this.setupFileModeUI();
    }
    this.resetUI();
    if (this.mode === 'webcam') {
      await this.setupWebcam();
      if (this.vitalLensInstance) {
        this.isProcessingFlag = true;
        this.vitalLensInstance.startVideoStream();
        this.setBufferingTimeout();
      }
      this.controlButtonElement.textContent = 'Pause';
    }
    if (this.mode === 'webcam') {
      this.webcamModeButtonElement.classList.add('active');
      this.fileModeButtonElement.classList.remove('active');
    } else {
      this.fileModeButtonElement.classList.add('active');
      this.webcamModeButtonElement.classList.remove('active');
    }
  }

  private async restartMode() {
    if (this.vitalLensInstance) {
      await this.vitalLensInstance.close();
      this.vitalLensInstance = undefined;
    }
    await this.startMode(this.mode, false, true);
    if (this.mode === 'file' && this.videoFileLoaded) {
      this.loadAndProcessFile(this.videoFileLoaded);
    }
  }

  private setupWebcamUI() {
    this.dropZoneElement.style.display = 'none';
    this.hideVideoLoader();
    this.videoInputElement.style.display = 'none';
    this.videoElement.style.display = 'block';
    this.canvasElement.style.display = 'block';
    this.controlButtonElement.textContent = 'Pause';
    const fileTooltip = this.shadowRoot!.querySelector(
      '.file-mode-tooltip'
    ) as HTMLElement;
    if (fileTooltip) fileTooltip.style.display = 'none';
  }

  private setupFileModeUI() {
    this.dropZoneElement.style.display = 'flex';
    this.videoElement.style.display = 'none';
    this.canvasElement.style.display = 'none';
    this.videoInputElement.style.display = 'none';
    this.controlButtonElement.textContent = 'Reset';
    const fileTooltip = this.shadowRoot!.querySelector(
      '.file-mode-tooltip'
    ) as HTMLElement;
    if (fileTooltip) fileTooltip.style.display = 'inline-block';
  }

  private resetVideoStreamView() {
    if (this.videoElement.srcObject) {
      (this.videoElement.srcObject as MediaStream)
        .getTracks()
        .forEach((track) => track.stop());
      this.videoElement.srcObject = null;
    }
    this.videoElement.src = '';
    this.videoElement.controls = false;
  }

  private resetVideoFileView() {
    this.videoElement.src = '';
    this.videoElement.controls = false;
    this.dropZoneElement.style.display = 'flex';
    this.videoElement.style.display = 'none';
    this.canvasElement.style.display = 'none';
    this.videoFileLoaded = null;
    this.videoInputElement.value = '';
    this.disablePlaybackDotPlugin();
  }

  protected async switchMode(newMode: string) {
    if (newMode === this.mode) return;
    if (this.mode === 'webcam' && this.vitalLensInstance) {
      this.vitalLensInstance.stopVideoStream();
      this.isProcessingFlag = false;
      this.resetVideoStreamView();
      if (this.bufferingTimeout) {
        clearTimeout(this.bufferingTimeout);
        this.bufferingTimeout = null;
      }
      this.hideVitalsLoader();
    }
    if (this.mode === 'file') {
      this.resetVideoFileView();
    }
    await this.startMode(newMode, true, false);
  }

  private handleVideoProgressEvent(message: string): void {
    console.log(message);
    this.showVideoLoader(message);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async handleStreamReset(_event: {
    message: string;
  }): Promise<void> {
    this.showError('Connection unstable. Reconnecting in 3 seconds...');

    if (this.mode === 'webcam' && this.vitalLensInstance) {
      this.vitalLensInstance.stopVideoStream();
      this.resetVideoStreamView();
    }
    this.resetUI();

    await new Promise((resolve) => setTimeout(resolve, 3000));

    if (this.mode === 'webcam') {
      try {
        await this.startMode('webcam', true, false);
      } catch (err) {
        console.error('Failed to automatically restart webcam mode:', err);
        this.showError(
          'Could not restart the camera. Please try again manually.'
        );
      }
    }
  }

  private handleResize() {
    this.setCanvasDimensions();
    if (this.charts.ppgChart) {
      this.charts.ppgChart.resize();
      this.charts.ppgChart.update();
    }
    if (this.charts.respChart) {
      this.charts.respChart.resize();
      this.charts.respChart.update();
    }
  }

  protected bindEvents() {
    this.dropZoneElement.addEventListener('click', () =>
      this.videoInputElement.click()
    );
    this.dropZoneElement.addEventListener('dragover', (event) => {
      event.preventDefault();
      this.dropZoneElement.classList.add('hover');
    });
    this.dropZoneElement.addEventListener('dragleave', () => {
      this.dropZoneElement.classList.remove('hover');
    });
    this.dropZoneElement.addEventListener('drop', (event) => {
      event.preventDefault();
      this.dropZoneElement.classList.remove('hover');
      const dataTransfer = event.dataTransfer;
      if (!dataTransfer) return;
      const files = dataTransfer.files;
      if (files.length) {
        const file = files[0];
        if (!file.type.startsWith('video/')) {
          this.showError('Error: Only video files are allowed.');
          return;
        }
        this.loadAndProcessFile(file);
      }
    });
    this.videoInputElement.addEventListener('change', () => {
      if (this.videoInputElement.files && this.videoInputElement.files.length) {
        const file = this.videoInputElement.files[0];
        if (!file.type.startsWith('video/')) {
          this.showError('Error: Only video files are allowed.');
          return;
        }
        this.loadAndProcessFile(file);
      }
    });
    this.methodSelectElement.addEventListener('change', () =>
      this.restartMode()
    );
    this.controlButtonElement.addEventListener('click', () => {
      if (this.mode === 'webcam' && this.vitalLensInstance) {
        if (this.isProcessingFlag) {
          this.vitalLensInstance.pauseVideoStream();
          this.controlButtonElement.textContent = 'Resume';
          this.isProcessingFlag = false;
          this.clearBufferingTimeout();
        } else {
          this.vitalLensInstance.startVideoStream();
          this.controlButtonElement.textContent = 'Pause';
          this.isProcessingFlag = true;
          this.setBufferingTimeout();
        }
      } else if (this.mode === 'file') {
        this.resetVideoFileView();
        this.resetUI();
        this.setupFileModeUI();
      }
    });
    this.downloadButtonElement.addEventListener('click', () => {
      if (this.latestResult) {
        const exportData = structuredClone(this.latestResult);

        // In webcam mode, inject the accumulated history from the WaveformPlayer
        if (this.mode === 'webcam') {
          let maxLength = 0;
          if (exportData.waveforms?.ppg_waveform) {
            exportData.waveforms.ppg_waveform.data = [...this.displayPpgData];
            exportData.waveforms.ppg_waveform.confidence = [
              ...this.displayPpgConf,
            ];
            maxLength = Math.max(maxLength, this.displayPpgData.length);
          }
          if (exportData.waveforms?.respiratory_waveform) {
            exportData.waveforms.respiratory_waveform.data = [
              ...this.displayRespData,
            ];
            exportData.waveforms.respiratory_waveform.confidence = [
              ...this.displayRespConf,
            ];
            maxLength = Math.max(maxLength, this.displayRespData.length);
          }

          // Synthesize a matching time array so the JSON is structurally sound
          if (maxLength > 0 && exportData.time && exportData.time.length > 0) {
            const latestTime = exportData.time[exportData.time.length - 1];
            const dt = 1.0 / this.ecoModeFps;
            const synthTime = new Array(maxLength);
            for (let i = 0; i < maxLength; i++) {
              synthTime[maxLength - 1 - i] = latestTime - i * dt;
            }
            exportData.time = synthTime;
          }
        }

        const dataStr =
          'data:text/json;charset=utf-8,' +
          encodeURIComponent(JSON.stringify(exportData, null, 2));
        const anchor = document.createElement('a');
        anchor.setAttribute('href', dataStr);
        anchor.setAttribute('download', 'vitals_result.json');
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }
    });

    this.webcamModeButtonElement?.addEventListener('click', () =>
      this.switchMode('webcam')
    );
    this.fileModeButtonElement?.addEventListener('click', () =>
      this.switchMode('file')
    );
    this.videoElement.addEventListener('timeupdate', () => {
      if (this.mode === 'file' && this.latestResult) {
        const currentTime = this.videoElement.currentTime;
        const times = this.latestResult.time || [];

        if (times.length > 0) {
          // Find the exact index whose timestamp is closest to the video's current time
          let closestIndex = 0;
          let minDiff = Infinity;
          for (let i = 0; i < times.length; i++) {
            const diff = Math.abs(times[i] - currentTime);
            if (diff < minDiff) {
              minDiff = diff;
              closestIndex = i;
            }
          }

          // Move the playback dots
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ppgPlugins = this.charts.ppgChart.options.plugins as any;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const respPlugins = this.charts.respChart.options.plugins as any;

          if (ppgPlugins.playbackDot) {
            ppgPlugins.playbackDot.xValue = closestIndex;
          }
          if (respPlugins.playbackDot) {
            respPlugins.playbackDot.xValue = closestIndex;
          }
          this.charts.ppgChart.update('none');
          this.charts.respChart.update('none');

          // Draw the ROI box perfectly synced to the same frame index
          const roiArray = this.latestResult.face.coordinates;
          if (roiArray && roiArray.length > closestIndex) {
            const currentRoi = roiArray[closestIndex];
            if (currentRoi) this.drawFaceBoxForRoi(currentRoi);
          }
        }
      }
    });
  }

  private showVideoLoader(message: string) {
    this.videoDimmerElement.style.display = 'block';
    this.videoSpinnerElement.style.display = 'block';
    this.videoProgressElement.style.display = 'block';
    this.videoProgressElement.textContent = message;
  }

  private hideVideoLoader() {
    this.videoDimmerElement.style.display = 'none';
    this.videoSpinnerElement.style.display = 'none';
    this.videoProgressElement.style.display = 'none';
    this.videoProgressElement.textContent = '';
  }

  private clearBufferingTimeout() {
    if (this.bufferingTimeout) {
      clearTimeout(this.bufferingTimeout);
      this.bufferingTimeout = null;
    }
    this.hideVitalsLoader();
  }

  private setBufferingTimeout() {
    const buffering = this.currentMethod.startsWith('vitallens');
    this.bufferingTimeout = window.setTimeout(() => {
      this.showVitalsLoader(
        buffering
          ? 'Make sure your internet connection is stable. Buffering...'
          : 'Loading...'
      );
    }, 500);
  }

  private showVitalsLoader(message: string) {
    this.vitalsDimmerElement.style.display = 'block';
    this.vitalsSpinnerElement.style.display = 'block';
    this.vitalsProgressElement.style.display = 'block';
    this.vitalsProgressElement.textContent = message;
  }

  private hideVitalsLoader() {
    this.vitalsDimmerElement.style.display = 'none';
    this.vitalsSpinnerElement.style.display = 'none';
    this.vitalsProgressElement.style.display = 'none';
    this.vitalsProgressElement.textContent = '';
  }

  public destroy(): void {
    window.removeEventListener('resize', this._handleResizeBound);
    this.resetVideoStreamView();
    this.resetVideoFileView();
    super.destroy();
  }
}

customElements.define('vitallens-widget', VitalLensWidget);
