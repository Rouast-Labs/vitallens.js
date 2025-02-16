/* eslint-disable @typescript-eslint/no-explicit-any */
import { VitalLens } from '../core/VitalLens.browser';
import template from './template.html';
import { Chart, ChartDataset, ScriptableLineSegmentContext } from 'chart.js';

export interface MyLineDataset extends ChartDataset<'line', number[]> {
  confidence?: number[];
}

class VitalLensWidget extends HTMLElement {
  private videoElement!: HTMLVideoElement;
  private canvasElement!: HTMLCanvasElement;
  private dropZoneElement!: HTMLElement;
  private videoInputElement!: HTMLInputElement;
  private spinnerElement!: HTMLElement;
  private webcamModeButtonElement!: HTMLButtonElement;
  private fileModeButtonElement!: HTMLButtonElement;
  private controlButtonElement!: HTMLButtonElement;
  private methodSelectElement!: HTMLSelectElement;
  private fpsDisplayElement!: HTMLElement;
  private logElement!: HTMLElement;
  private downloadButtonElement!: HTMLButtonElement;
  private vitalLensInstance!: VitalLens;
  private charts: any = {};
  private videoFileLoaded: File | null = null;
  private currentMethod: string | null = null;
  private logMessages: string[] = [];
  private latestResult: any = null;
  private isProcessingFlag: boolean = false;
  private MAX_DATA_POINTS: number = 300;
  private mode: 'webcam' | 'file' = 'file';

  constructor() {
    super();
    // Create a shadow DOM and inject the template.
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = template;
  }

  connectedCallback() {
    // Query the shadow DOM for all UI elements.
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
    this.fpsDisplayElement = this.shadowRoot!.querySelector(
      '#fpsDisplay'
    ) as HTMLElement;
    this.logElement = this.shadowRoot!.querySelector('#log') as HTMLElement;
    this.downloadButtonElement = this.shadowRoot!.querySelector(
      '#downloadButton'
    ) as HTMLButtonElement;

    // Read configuration from attributes.
    const apiKey = this.getAttribute('api-key') || '';
    const method = this.getAttribute('method') || 'vitallens';
    const proxyUrl = this.getAttribute('proxy-url') || null;
    const options: any = { method };
    if (proxyUrl) {
      options.proxyUrl = proxyUrl;
    } else {
      options.apiKey = apiKey;
    }

    // Initialize the VitalLens instance.
    this.initVitalLensInstance(options)
      .then(() => {
        // Bind UI events.
        this.bindEvents();
        // Set default mode (for example, file mode).
        this.switchMode('file');
      })
      .catch((err) => {
        this.addLog('Error initializing VitalLens: ' + err);
      });
  }

  disconnectedCallback() {
    // Clean up resources.
    if (this.vitalLensInstance) {
      this.vitalLensInstance.stopVideoStream();
      this.vitalLensInstance.close();
    }
  }

  private addLog(message: string) {
    if (this.logMessages.length >= 2) {
      this.logMessages.shift();
    }
    this.logMessages.push(message);
    this.logElement.textContent = this.logMessages.join('\n');
  }

  private updateFpsDisplay(fps: number, estFps: number) {
    this.fpsDisplayElement.textContent = `FPS: ${fps ? fps.toFixed(1) : 'N/A'} | estFps: ${estFps ? estFps.toFixed(1) : 'N/A'}`;
  }

  private createChart(elementId: string, label: string, baseColor: string) {
    const ctx = (
      this.shadowRoot!.querySelector(`#${elementId}`) as HTMLCanvasElement
    ).getContext('2d');
    return new Chart(ctx!, {
      type: 'line',
      data: {
        labels: [] as string[],
        datasets: [
          {
            label,
            data: [] as number[],
            confidence: [] as number[],
            borderColor: `rgba(${baseColor},1)`,
            segment: {
              borderColor: (ctx: ScriptableLineSegmentContext): string => {
                const chart = (ctx as any).chart;
                // Now we know this dataset is of type MyLineDataset.
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
          playbackDot: {
            xValue: 0,
            radius: 4,
            lineWidth: 2,
            strokeStyle: 'white',
          },
          legend: {
            display: true,
            position: 'top',
            align: 'start',
            labels: {
              boxWidth: 0,
              color: `rgba(${baseColor},1)`,
              font: { size: 16, weight: 'bold' },
            },
          },
        },
        animation: false,
        scales: { x: { display: false }, y: { display: false } },
      },
    });
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

  private updateStats(
    elementId: string,
    label: string,
    value: number | undefined
  ) {
    const element = this.shadowRoot!.querySelector(
      `#${elementId}`
    ) as HTMLElement;
    if (!element) return;
    const color = elementId === 'ppgStats' ? 'red' : 'blue';
    element.innerHTML = `
      <p style="font-size: 16px; margin: 10px 0 0; font-weight: bold; color: ${color};">${label}</p>
      <p style="font-size: 48px; margin: 16px 0 0; font-weight: bold; color: ${color};">
        ${value !== undefined ? value.toFixed(0) : 'N/A'}
      </p>`;
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
      heart_rate && heart_rate.confidence >= 0.8 ? heart_rate.value : undefined;
    const rrValue =
      respiratory_rate && respiratory_rate.confidence >= 0.8
        ? respiratory_rate.value
        : undefined;
    this.updateStats('ppgStats', 'HR   bpm', hrValue);
    this.updateStats('respStats', 'RR   bpm', rrValue);
    this.updateFpsDisplay(fps, estFps);
  }

  private async initVitalLensInstance(options: any) {
    const selectedMethod = this.methodSelectElement.value || 'vitallens';
    if (this.vitalLensInstance && this.currentMethod === selectedMethod) return;
    if (this.vitalLensInstance) {
      try {
        await this.vitalLensInstance.close();
      } catch (e) {
        console.error('Error closing previous VitalLens instance:', e);
      }
    }
    this.currentMethod = selectedMethod;
    try {
      this.vitalLensInstance = new VitalLens(options);
      this.vitalLensInstance.addEventListener(
        'vitals',
        this.handleVitalLensResults.bind(this)
      );
    } catch (e) {
      this.addLog('Error initializing VitalLens: ' + (e as Error).message);
      console.error(e);
    }
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
      this.addLog('Error accessing webcam: ' + (e as Error).message);
      console.error(e);
    }
  }

  private setupWebcamUI() {
    this.dropZoneElement.style.display = 'none';
    this.videoInputElement.style.display = 'none';
    this.spinnerElement.style.display = 'none';
    this.videoElement.style.display = 'block';
    this.canvasElement.style.display = 'block';
    this.controlButtonElement.textContent = 'Pause';
  }

  private setupFileModeUI() {
    this.addLog('File mode activated.');
    this.dropZoneElement.style.display = 'flex';
    this.videoElement.style.display = 'none';
    this.canvasElement.style.display = 'none';
    this.videoInputElement.style.display = 'none';
    this.controlButtonElement.textContent = 'Reset';
  }

  private async loadAndProcessFile(file: File) {
    this.addLog('Processing file: ' + file.name);
    this.dropZoneElement.style.display = 'none';
    this.spinnerElement.style.display = 'block';
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
      this.videoElement.controls = true;
    };
  }

  private async processFile(file: File) {
    try {
      const result = await this.vitalLensInstance.processVideoFile(file);
      this.addLog('File processing complete.');
      this.handleVitalLensResults(result);
    } catch (e) {
      this.addLog('Error processing file: ' + (e as Error).message);
      console.error(e);
    }
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
  }

  private resetVitalsView() {
    this.updateChart(this.charts.ppgChart, [], [], this.MAX_DATA_POINTS);
    this.updateChart(this.charts.respChart, [], [], this.MAX_DATA_POINTS);
    this.updateStats('ppgStats', 'HR   bpm', undefined);
    this.updateStats('respStats', 'RR   bpm', undefined);
    this.updateFpsDisplay(0, 0);
  }

  private async switchMode(newMode: 'webcam' | 'file') {
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
    modeToStart: 'webcam' | 'file',
    initUI: boolean,
    restartVitalLens: boolean
  ) {
    this.mode = modeToStart;
    if (!this.vitalLensInstance || restartVitalLens) {
      const apiKey = this.getAttribute('api-key') || '';
      const method = this.getAttribute('method') || 'vitallens';
      const proxyUrl = this.getAttribute('proxy-url') || null;
      const options: any = { method };
      if (proxyUrl) {
        options.proxyUrl = proxyUrl;
      } else {
        options.apiKey = apiKey;
      }
      await this.initVitalLensInstance(options);
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
    // Update tab styling.
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

  private bindEvents() {
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
      const files = (event.dataTransfer as DataTransfer).files;
      if (files.length) this.loadAndProcessFile(files[0]);
    });
    this.videoInputElement.addEventListener('change', () => {
      if (this.videoInputElement.files && this.videoInputElement.files.length)
        this.loadAndProcessFile(this.videoInputElement.files[0]);
    });
    this.methodSelectElement.addEventListener('change', () =>
      this.restartMode()
    );
    this.controlButtonElement.addEventListener('click', () => {
      if (this.mode === 'webcam') {
        if (this.isProcessingFlag) {
          this.vitalLensInstance.pauseVideoStream();
          this.controlButtonElement.textContent = 'Resume';
          this.addLog('Webcam paused.');
          this.isProcessingFlag = false;
        } else {
          this.vitalLensInstance.startVideoStream();
          this.controlButtonElement.textContent = 'Pause';
          this.addLog('Webcam resumed.');
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
        this.addLog('Results downloaded.');
      } else {
        this.addLog('No result available to download.');
      }
    });
    window.addEventListener('resize', () => this.handleResize());
    this.webcamModeButtonElement.addEventListener('click', () =>
      this.switchMode('webcam')
    );
    this.fileModeButtonElement.addEventListener('click', () =>
      this.switchMode('file')
    );
    // Update playback dot marker and ROI on video timeupdate (only in file mode)
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

  init() {
    // Initialize charts using Chart.js.
    this.charts.ppgChart = this.createChart('ppgChart', 'Pulse', '255,0,0');
    this.charts.respChart = this.createChart(
      'respChart',
      'Respiration',
      '0,0,255'
    );
    // Start in file mode by default.
    this.switchMode('file');
  }
}

customElements.define('vitallens-widget', VitalLensWidget);
export default VitalLensWidget;
