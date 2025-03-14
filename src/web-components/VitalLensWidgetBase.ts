/* eslint-disable @typescript-eslint/no-explicit-any */
import { VitalLens } from '../core/VitalLens.browser';
import { VitalLensOptions } from '../types';
import widget from './widget.html';
import logoUrl from '../../assets/vitallens_api.png';
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

// Register plugins.
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

export class VitalLensWidgetBase extends HTMLElement {
  // Common properties
  protected videoElement!: HTMLVideoElement;
  protected canvasElement!: HTMLCanvasElement;
  protected dropZoneElement!: HTMLElement;
  protected videoInputElement!: HTMLInputElement;
  protected spinnerElement!: HTMLElement;
  protected progressElement!: HTMLElement;
  protected webcamModeButtonElement!: HTMLButtonElement;
  protected fileModeButtonElement!: HTMLButtonElement;
  protected controlButtonElement!: HTMLButtonElement;
  protected methodSelectElement!: HTMLSelectElement;
  protected fpsValueElement!: HTMLElement;
  protected downloadButtonElement!: HTMLButtonElement;
  protected vitalLensInstance!: VitalLens;
  protected charts: any = {};
  protected videoFileLoaded: File | null = null;
  protected currentMethod: 'vitallens' | 'pos' | 'chrom' | 'g' = 'vitallens';
  protected latestResult: any = null;
  protected isProcessingFlag: boolean = false;
  protected MAX_DATA_POINTS: number = 300;
  protected apiKey: string | null = null;
  protected proxyUrl: string | null = null;
  protected mode: string = '';
  protected debug: boolean = false;
  private _handleResizeBound = this.handleResize.bind(this);

  constructor(widgetString: string = widget.replace('__LOGO_URL__', logoUrl)) {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = widgetString;
  }

  disconnectedCallback() {
    this.destroy();
  }

  protected getElements() {
    this.videoElement = this.shadowRoot!.querySelector(
      '#video'
    ) as HTMLVideoElement;
    this.canvasElement = this.shadowRoot!.querySelector(
      '#canvas'
    ) as HTMLCanvasElement;
    this.dropZoneElement = this.shadowRoot!.querySelector(
      '#dropZone'
    ) as HTMLElement;
    this.videoInputElement = this.shadowRoot!.querySelector(
      '#videoInput'
    ) as HTMLInputElement;
    this.spinnerElement = this.shadowRoot!.querySelector(
      '#spinner'
    ) as HTMLElement;
    this.progressElement = this.shadowRoot!.querySelector(
      '#progressMessage'
    ) as HTMLElement;
    this.webcamModeButtonElement = this.shadowRoot!.querySelector(
      '#webcamModeButton'
    ) as HTMLButtonElement;
    this.fileModeButtonElement = this.shadowRoot!.querySelector(
      '#fileModeButton'
    ) as HTMLButtonElement;
    this.controlButtonElement = this.shadowRoot!.querySelector(
      '#controlButton'
    ) as HTMLButtonElement;
    this.methodSelectElement = this.shadowRoot!.querySelector(
      '#methodSelect'
    ) as HTMLSelectElement;
    this.fpsValueElement = this.shadowRoot!.querySelector(
      '#fpsDisplay .fps-value'
    ) as HTMLElement;
    this.downloadButtonElement = this.shadowRoot!.querySelector(
      '#downloadButton'
    ) as HTMLButtonElement;
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
                const avgConf = Math.min((conf1 + conf2) / 2 + 0.1, 1);
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
    const rect = this.canvasElement.getBoundingClientRect();
    this.canvasElement.width = rect.width;
    this.canvasElement.height = rect.height;
  }

  private drawFaceBoxForRoi(roi: [number, number, number, number]) {
    if (this.debug) {
      const ctx = this.canvasElement.getContext('2d');
      ctx!.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
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
      ctx!.strokeStyle = 'rgba(0, 255, 0, 0.8)';
      ctx!.lineWidth = 2;
      ctx!.strokeRect(boxX, boxY, boxW, boxH);
    }
  }

  private updateStats(
    elementId: string,
    label: string,
    value: number | undefined
  ) {
    const element = this.shadowRoot!.querySelector(
      `#${elementId}`
    ) as HTMLElement;
    if (!element) return;
    const color = elementId === 'ppgStats' ? '#e62300' : '#007bff';
    element.innerHTML = `
      <p style="font-size: 16px; margin: 10px 0 0; font-weight: bold; color: ${color};">${label}</p>
      <p style="font-size: 48px; margin: 16px 0 0; font-weight: bold; color: ${color};">
        ${value !== undefined ? value.toFixed(0) : 'N/A'}
      </p>`;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private updateFpsValue(fps: number, estFps: number) {
    this.fpsValueElement.textContent = fps ? fps.toFixed(1) : 'N/A';
  }

  private async initVitalLensInstance() {
    const selectedMethod = this.methodSelectElement.value || 'vitallens';
    if (this.vitalLensInstance && this.currentMethod === selectedMethod) return;
    if (this.vitalLensInstance) {
      try {
        await this.vitalLensInstance.close();
      } catch (e) {
        console.error('Error closing previous VitalLens instance:', e);
      }
    }
    this.currentMethod = selectedMethod as any;
    const options: VitalLensOptions = {
      method: this.currentMethod,
      ...(this.apiKey ? { apiKey: this.apiKey } : {}),
      ...(this.proxyUrl ? { proxyUrl: this.proxyUrl } : {}),
    };
    try {
      this.vitalLensInstance = new VitalLens(options);
      this.vitalLensInstance.addEventListener(
        'vitals',
        this.handleVitalLensResults.bind(this)
      );
      this.vitalLensInstance.addEventListener(
        'progress',
        this.handleProgressEvent.bind(this)
      );
    } catch (e) {
      console.error(e);
    }
  }

  private handleProgressEvent(event: any) {
    this.progressElement.textContent = event;
  }

  private async setupWebcam() {
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
    this.spinnerElement.style.display = 'block';
    this.progressElement.style.display = 'block';
    this.videoElement.style.display = 'block';
    this.canvasElement.style.display = 'block';
    const url = URL.createObjectURL(file);
    this.videoElement.src = url;
    this.videoElement.load();
    this.videoElement.onloadeddata = async () => {
      this.videoFileLoaded = file;
      this.setCanvasDimensions();
      this.videoElement.pause();
      await this.processFile(file);
      this.spinnerElement.style.display = 'none';
      this.progressElement.style.display = 'none';
      this.videoElement.controls = true;
    };
  }

  private async processFile(file: File) {
    try {
      const result = await this.vitalLensInstance.processVideoFile(file);
      this.enablePlaybackDotPlugin();
      this.handleVitalLensResults(result);
      const progressMessageElement = this.shadowRoot!.querySelector(
        '#progressMessage'
      ) as HTMLElement;
      if (progressMessageElement) {
        progressMessageElement.textContent = '';
      }
    } catch (e) {
      console.error(e);
    }
  }

  protected async switchMode(newMode: string) {
    if (newMode === this.mode) return;
    if (this.mode === 'webcam' && this.vitalLensInstance) {
      this.vitalLensInstance.stopVideoStream();
      this.isProcessingFlag = false;
      this.resetVideoStreamView();
    }
    if (this.mode === 'file') {
      this.resetVideoFileView();
    }
    this.resetVitalsView();
    await this.startMode(newMode, true, false);
  }

  private async startMode(
    modeToStart: string,
    initUI: boolean,
    restartVitalLens: boolean
  ) {
    this.mode = modeToStart;
    if (!this.vitalLensInstance || restartVitalLens) {
      await this.initVitalLensInstance();
    }
    if (initUI) {
      if (modeToStart === 'webcam') {
        this.setupWebcamUI();
      } else {
        this.setupFileModeUI();
      }
    }
    if (this.mode === 'webcam') {
      await this.setupWebcam();
      this.isProcessingFlag = true;
      this.vitalLensInstance.startVideoStream();
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
    try {
      await this.vitalLensInstance.close();
    } catch (e) {
      console.error('Error closing vitalLensInstance:', e);
    }
    await this.startMode(this.mode, false, true);
    if (this.mode === 'file' && this.videoFileLoaded) {
      this.loadAndProcessFile(this.videoFileLoaded);
    }
  }

  private setupWebcamUI() {
    this.dropZoneElement.style.display = 'none';
    this.videoInputElement.style.display = 'none';
    this.spinnerElement.style.display = 'none';
    this.progressElement.style.display = 'none';
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

  private resetVitalsView() {
    this.updateChart(this.charts.ppgChart, [], [], this.MAX_DATA_POINTS);
    this.updateChart(this.charts.respChart, [], [], this.MAX_DATA_POINTS);
    this.updateStats('ppgStats', 'HR   bpm', undefined);
    this.updateStats('respStats', 'RR   bpm', undefined);
    this.updateFpsValue(0, 0);
  }

  private handleVitalLensResults(result: any) {
    this.latestResult = result;
    const { face, vital_signs, fps, estFps } = result;
    if (!face?.coordinates) {
      this.canvasElement
        .getContext('2d')!
        .clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
    } else {
      this.drawFaceBoxForRoi(face.coordinates[face.coordinates.length - 1]);
    }
    const { ppg_waveform, respiratory_waveform, heart_rate, respiratory_rate } =
      vital_signs;
    if (this.mode === 'webcam') {
      this.updateChart(
        this.charts.ppgChart,
        ppg_waveform?.data || [],
        ppg_waveform?.confidence || [],
        this.MAX_DATA_POINTS
      );
      this.updateChart(
        this.charts.respChart,
        respiratory_waveform?.data || [],
        respiratory_waveform?.confidence || [],
        this.MAX_DATA_POINTS
      );
    } else {
      this.updateChart(
        this.charts.ppgChart,
        ppg_waveform?.data || [],
        ppg_waveform?.confidence || []
      );
      this.updateChart(
        this.charts.respChart,
        respiratory_waveform?.data || [],
        respiratory_waveform?.confidence || []
      );
    }
    const hrValue =
      heart_rate && heart_rate.confidence >= 0.7 ? heart_rate.value : undefined;
    const rrValue =
      respiratory_rate && respiratory_rate.confidence >= 0.7
        ? respiratory_rate.value
        : undefined;
    this.updateStats('ppgStats', 'HR   bpm', hrValue);
    this.updateStats('respStats', 'RR   bpm', rrValue);
    this.updateFpsValue(fps, estFps);
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
          console.error('Error: Only video files are allowed.');
          return;
        }
        this.loadAndProcessFile(file);
      }
    });
    this.videoInputElement.addEventListener('change', () => {
      if (this.videoInputElement.files && this.videoInputElement.files.length) {
        const file = this.videoInputElement.files[0];
        if (!file.type.startsWith('video/')) {
          console.error('Error: Only video files are allowed.');
          return;
        }
        this.loadAndProcessFile(file);
      }
    });
    this.methodSelectElement.addEventListener('change', () =>
      this.restartMode()
    );
    this.controlButtonElement.addEventListener('click', () => {
      if (this.mode === 'webcam') {
        if (this.isProcessingFlag) {
          this.vitalLensInstance.pauseVideoStream();
          this.controlButtonElement.textContent = 'Resume';
          this.isProcessingFlag = false;
        } else {
          this.vitalLensInstance.startVideoStream();
          this.controlButtonElement.textContent = 'Pause';
          this.isProcessingFlag = true;
        }
      } else if (this.mode === 'file') {
        this.resetVideoFileView();
        this.resetVitalsView();
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
    window.addEventListener('resize', this._handleResizeBound);
    const webcamButton = this.shadowRoot!.querySelector(
      '#webcamModeButton'
    ) as HTMLButtonElement;
    const fileButton = this.shadowRoot!.querySelector(
      '#fileModeButton'
    ) as HTMLButtonElement;
    webcamButton?.addEventListener('click', () => this.switchMode('webcam'));
    fileButton?.addEventListener('click', () => this.switchMode('file'));
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
          const currentIndex = Math.floor(
            (this.videoElement.currentTime / this.videoElement.duration) *
              roiArray.length
          );
          const currentRoi = roiArray[currentIndex];
          if (currentRoi) this.drawFaceBoxForRoi(currentRoi);
        }
      }
    });
  }

  public destroy(): void {
    window.removeEventListener('resize', this._handleResizeBound);

    if (this.vitalLensInstance) {
      try {
        this.vitalLensInstance.close();
      } catch (e) {
        console.error('Error closing vitalLensInstance:', e);
      }
    }

    this.resetVideoStreamView();
    this.resetVideoFileView();

    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = '';
    }
  }
}

customElements.define('vitallens-widget-base', VitalLensWidgetBase);
