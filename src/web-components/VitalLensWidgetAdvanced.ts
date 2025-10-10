/* eslint-disable @typescript-eslint/no-explicit-any */
import { VitalLensWidgetBase } from './VitalLensWidgetBase';
import { Method, VitalLensOptions, VitalLensResult } from '../types';
import widget from './widget.html';
import logoUrl from '../../assets/logo.svg';
import {
  Chart,
  ChartDataset,
  CategoryScale,
  LinearScale,
  LineController,
  PointElement,
  LineElement,
  ScriptableLineSegmentContext,
} from 'chart.js';
import { AGG_WINDOW_SIZE } from '../config/constants';

// Chart.js plugins (as before)
const playbackDotPlugin = {
  id: 'playbackDot',
  afterDatasetsDraw(chart: Chart, args: { cancelable: boolean }, options: any) {
    const ctx = chart.ctx;
    const markerIndex = options.xValue;
    if (markerIndex === undefined || markerIndex === null) return;
    const dataset = chart.data.datasets[0];
    const data = dataset.data;
    if (!data || data.length === 0) return;
    const index = Math.round(markerIndex);
    if (index < 0 || index >= data.length) return;
    const xScale = chart.scales.x;
    const yScale = chart.scales.y;
    const xPixel = xScale.getPixelForValue(index);
    const yValue = data[index];
    if (typeof yValue !== 'number') return;
    const yPixel = yScale.getPixelForValue(yValue);
    const radius = options.radius || 4;
    ctx.save();
    ctx.beginPath();
    ctx.arc(xPixel, yPixel, radius, 0, 2 * Math.PI);
    ctx.fillStyle = dataset.borderColor as string;
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
    args: any,
    options: { text: string; font?: string; color?: string }
  ) {
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

export interface MyLineDataset extends ChartDataset<'line', number[]> {
  confidence?: number[];
}

export abstract class VitalLensWidgetAdvanced extends VitalLensWidgetBase {
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

  protected charts: any = {};
  protected videoFileLoaded: File | null = null;
  protected currentMethod: Method = 'vitallens';
  protected mode: string = '';
  protected debug: boolean = false;
  protected readonly ecoModeFps: number = 15;
  protected bufferingTimeout: number | null = null;
  private _handleResizeBound = this.handleResize.bind(this);

  constructor() {
    super();
    this.shadowRoot!.innerHTML = widget.replace('__LOGO_URL__', logoUrl);
  }

  connectedCallback() {
    super.connectedCallback();
    this.charts.ppgChart = this.createChart(
      'ppgChart',
      'PPG Waveform',
      '230,34,0'
    );
    this.charts.respChart = this.createChart(
      'respChart',
      'Respiratory Waveform',
      '0,123,255'
    );
    this.bindEvents();
    window.addEventListener('resize', this._handleResizeBound);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('resize', this._handleResizeBound);
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

  protected updateUI(result: VitalLensResult): void {
    this.clearBufferingTimeout();
    const { face, vital_signs, fps, estFps } = result;

    if (!face?.coordinates || face.coordinates.length === 0) {
      this.canvasElement
        .getContext('2d')!
        .clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
    } else {
      this.drawFaceBoxForRoi(face.coordinates[face.coordinates.length - 1]);
    }

    const {
      ppg_waveform,
      respiratory_waveform,
      heart_rate,
      respiratory_rate,
      hrv_sdnn,
      hrv_rmssd,
    } = vital_signs;

    const maxDataPoints =
      this.mode === 'webcam' ? AGG_WINDOW_SIZE * this.ecoModeFps : undefined;

    this.updateChart(
      this.charts.ppgChart,
      ppg_waveform?.data || [],
      ppg_waveform?.confidence || [],
      maxDataPoints
    );
    this.updateChart(
      this.charts.respChart,
      respiratory_waveform?.data || [],
      respiratory_waveform?.confidence || [],
      maxDataPoints
    );

    this.updateNumericValue('hr-value', heart_rate?.value, 0);
    this.updateNumericValue('rr-value', respiratory_rate?.value, 0);
    this.updateNumericValue('hrv-sdnn', hrv_sdnn?.value, 1);
    this.updateNumericValue('hrv-rmssd', hrv_rmssd?.value, 1);

    this.updateFpsValue(fps, estFps);

    if (this.mode === 'webcam') this.setBufferingTimeout();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async handleStreamReset(event: { message: string }): Promise<void> {
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

  protected resetUI(): void {
    const maxDataPoints = AGG_WINDOW_SIZE * this.ecoModeFps;
    this.updateChart(this.charts.ppgChart, [], [], maxDataPoints);
    this.updateChart(this.charts.respChart, [], [], maxDataPoints);
    this.updateNumericValue('hr-value', undefined);
    this.updateNumericValue('rr-value', undefined);
    this.updateNumericValue('hrv-sdnn', undefined);
    this.updateNumericValue('hrv-rmssd', undefined);
    this.updateFpsValue(0, 0);
  }

  protected async initVitalLensInstance(): Promise<void> {
    const selectedMethod =
      (this.methodSelectElement.value as Method) || 'vitallens';

    if (this.vitalLensInstance && this.currentMethod === selectedMethod) return;

    this.currentMethod = selectedMethod;

    const options: Partial<VitalLensOptions> = {
      method: this.currentMethod,
      overrideFpsTarget: this.ecoModeFps,
    };

    // Call the base class implementation with the assembled options
    await super.initVitalLensInstance(options);

    if (this.vitalLensInstance) {
      this.vitalLensInstance.addEventListener('fileProgress', (e) =>
        this.handleVideoProgressEvent(e as string)
      );
    }
  }

  private handleVideoProgressEvent(message: string): void {
    console.log(message);
    this.showVideoLoader(message);
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

  protected createChart(elementId: string, label: string, baseColor: string) {
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
            confidence: [],
            borderColor: `rgba(${baseColor},1)`,
            segment: {
              borderColor: (ctx: ScriptableLineSegmentContext): string => {
                const chart = (ctx as any).chart;
                const dataset = chart.data.datasets[0] as MyLineDataset;
                const confArray = dataset.confidence;
                if (!confArray) return `rgba(${baseColor},1)`;
                const i = ctx.p0DataIndex;
                const conf1 = confArray[i] !== undefined ? confArray[i] : 1;
                const conf2 =
                  confArray[i + 1] !== undefined ? confArray[i + 1] : conf1;
                const avgConf = Math.min((conf1 + conf2) / 2 + 0.3, 1);
                return `rgba(${baseColor},${avgConf})`;
              },
            },
            borderWidth: 2,
            tension: 0,
            pointRadius: 0,
          } as MyLineDataset,
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
        },
        animation: false,
        scales: { x: { display: false }, y: { display: false } },
      },
    }) as any;
    chart.options.plugins.overlayTitle = {
      text: label,
      font: 'bold 16px sans-serif',
      color: `rgba(${baseColor},1)`,
    };
    return chart;
  }

  private updateChart(
    chart: any,
    newData: number[],
    newConfidence: number[],
    maxDataPoints?: number
  ) {
    const maxPoints =
      maxDataPoints !== undefined
        ? maxDataPoints
        : newData
          ? newData.length
          : 0;
    let dataToDisplay =
      newData && newData.length ? newData : new Array(maxPoints).fill(0);
    let confidenceToUse =
      newConfidence && newConfidence.length
        ? newConfidence
        : new Array(maxPoints).fill(1);
    if (maxPoints > 0) {
      if (dataToDisplay.length > maxPoints) {
        dataToDisplay = dataToDisplay.slice(-maxPoints);
      }
      if (confidenceToUse.length > maxPoints) {
        confidenceToUse = confidenceToUse.slice(-maxPoints);
      }
      if (dataToDisplay.length < maxPoints) {
        const zerosNeeded = maxPoints - dataToDisplay.length;
        const zeroPad = new Array(zerosNeeded).fill(0);
        dataToDisplay = zeroPad.concat(dataToDisplay);
      }
      if (confidenceToUse.length < maxPoints) {
        const zerosNeeded = maxPoints - confidenceToUse.length;
        const zeroPad = new Array(zerosNeeded).fill(1);
        confidenceToUse = zeroPad.concat(confidenceToUse);
      }
    }
    chart.data.datasets[0].data = dataToDisplay;
    chart.data.datasets[0].confidence = confidenceToUse;
    chart.data.labels = Array.from({ length: maxPoints }, (_, i) => i);
    chart.update();
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

  private updateNumericValue(
    elementId: string,
    value: number | null | undefined,
    toFixed = 0
  ): void {
    const element = this.shadowRoot?.querySelector(
      `#${elementId}`
    ) as HTMLElement | null;
    if (!element) return;

    if (value !== null && value !== undefined) {
      element.textContent = value.toFixed(toFixed);
    } else {
      element.textContent = '--';
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private updateFpsValue(fps: number | undefined, estFps: number | undefined) {
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
    this.charts.ppgChart.options.plugins.playbackDot = {
      xValue: 0,
      radius: 4,
      lineWidth: 2,
      strokeStyle: 'white',
    };
    this.charts.respChart.options.plugins.playbackDot = {
      xValue: 0,
      radius: 4,
      lineWidth: 2,
      strokeStyle: 'white',
    };
    this.charts.ppgChart.update();
    this.charts.respChart.update();
  }

  private disablePlaybackDotPlugin() {
    if (this.charts.ppgChart.options.plugins.playbackDot) {
      delete this.charts.ppgChart.options.plugins.playbackDot;
    }
    if (this.charts.respChart.options.plugins.playbackDot) {
      delete this.charts.respChart.options.plugins.playbackDot;
    }
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
      if (!dataTransfer) {
        console.error('Error: DataTransfer is null.');
        return;
      }
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
        const dataStr =
          'data:text/json;charset=utf-8,' +
          encodeURIComponent(JSON.stringify(this.latestResult, null, 2));
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
        const duration = this.videoElement.duration;
        const waveformLength =
          this.latestResult.vital_signs?.ppg_waveform?.data?.length || 0;
        if (duration > 0 && waveformLength > 0) {
          const markerIndex = (currentTime / duration) * (waveformLength - 1);
          if (this.charts.ppgChart.options.plugins.playbackDot) {
            this.charts.ppgChart.options.plugins.playbackDot.xValue =
              markerIndex;
          }
          if (this.charts.respChart.options.plugins.playbackDot) {
            this.charts.respChart.options.plugins.playbackDot.xValue =
              markerIndex;
          }
          this.charts.ppgChart.update('none');
          this.charts.respChart.update('none');
        }
        const roiArray = this.latestResult.face.coordinates;
        if (roiArray && roiArray.length) {
          const currentIndex = Math.min(
            roiArray.length - 1,
            Math.floor(
              (this.videoElement.currentTime / this.videoElement.duration) *
                roiArray.length
            )
          );
          const currentRoi = roiArray[currentIndex];
          if (currentRoi) this.drawFaceBoxForRoi(currentRoi);
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
    super.destroy(); // Handles closing the instance and clearing the shadow DOM
  }
}
