import { getCore } from './wasmProvider';
import { BufferManager } from '../processing/BufferManager';
import { MethodHandler } from '../methods/MethodHandler';
import { MethodHandlerFactory } from '../methods/MethodHandlerFactory';
import {
  VitalLensOptions,
  VitalLensResult,
  VideoInput,
  MethodConfig,
  Vital,
} from '../types/core';
import { IVitalLensController } from '../types/IVitalLensController';
import { METHODS_CONFIG } from '../config/methodsConfig';
import { Session } from '../processing/Session';
import { isBrowser } from '../utils/env';
import { IRestClient } from '../types/IRestClient';
import { IStreamProcessor } from '../types/IStreamProcessor';
import { IFrameIterator } from '../types/IFrameIterator';
import { IFFmpegWrapper } from '../types/IFFmpegWrapper';
import { FrameIteratorFactory } from '../processing/FrameIteratorFactory';
import { StageTimer } from '../utils/StageTimer';
import {
  SLOW_WORKER_READY_MS,
  SLOW_DETECTION_MS,
  SLOW_FIRST_FACE_MS,
  SLOW_FIRST_RESULT_MS,
  SLOW_API_REQUEST_MS,
} from '../config/constants';
import {
  IFaceDetectionWorker,
  DetectorHooks,
} from '../types/IFaceDetectionWorker';

/**
 * Base class for VitalLensController, managing frame processing, buffering,
 * and predictions for both file-based and live stream scenarios.
 */
export abstract class VitalLensControllerBase implements IVitalLensController {
  protected frameIteratorFactory: FrameIteratorFactory | null = null;
  protected bufferManager: BufferManager;
  protected streamProcessor: IStreamProcessor | null = null;
  protected methodHandler: MethodHandler;
  protected methodConfig: MethodConfig;
  protected faceDetectionWorker: IFaceDetectionWorker | null = null;
  protected detectorReady = false;
  protected stageTimer: StageTimer;
  protected ffmpeg: IFFmpegWrapper | null = null;
  protected session: Session | null = null;
  protected eventListeners: { [event: string]: ((data: unknown) => void)[] } =
    {};

  constructor(protected options: VitalLensOptions) {
    this.stageTimer = new StageTimer(options.debug ?? false);
    this.methodConfig = METHODS_CONFIG[this.options.method];
    this.bufferManager = new BufferManager();
    this.methodHandler = this.createMethodHandler(options);
    this.frameIteratorFactory = new FrameIteratorFactory(options, () =>
      this.methodHandler.getConfig()
    );
    if (options.globalRoi === undefined) {
      this.faceDetectionWorker = this.createFaceDetectionWorker();
      this.watchWorkerReady(this.faceDetectionWorker);
    }
  }

  /**
   * Warns about slow start-up stages. Only applies to live streams.
   */
  private watchStreamStartup(): void {
    if (!this.faceDetectionWorker) return;
    this.stageTimer.watch('workerReady', SLOW_WORKER_READY_MS);
    this.stageTimer.watch('firstFace', SLOW_FIRST_FACE_MS);
  }

  /**
   * Listens for the worker's ready message (model loaded, or load failed).
   * @param worker - The face detection worker to watch.
   */
  private watchWorkerReady(worker: IFaceDetectionWorker): void {
    worker.addEventListener?.('message', ((ev: MessageEvent) => {
      if (ev.data?.type !== 'ready' || worker !== this.faceDetectionWorker)
        return;
      if (ev.data.error) {
        console.warn(`Face detection model failed to load: ${ev.data.error}`);
        this.dispatchEvent('status', {
          stage: 'detectorFailed',
          reason: `model load failed: ${ev.data.error}`,
        });
        return;
      }
      this.detectorReady = true;
      this.stageTimer.mark('workerReady');
      this.dispatchEvent('status', {
        stage: 'workerReady',
        loadMs: ev.data.loadMs,
      });
    }) as EventListener);
  }

  /**
   * Subclasses must return the appropriate RestClient instance.
   */
  protected abstract createRestClient(
    apiKey: string,
    proxyUrl?: string
  ): IRestClient;

  /**
   * Subclasses must return the appropriate FFmpegWrapper instance.
   */
  protected abstract createFFmpegWrapper(): IFFmpegWrapper;

  /**
   * Subclasses must return the appropriate Worker instance.
   */
  protected abstract createFaceDetectionWorker(): IFaceDetectionWorker;

  /**
   * Subclasses must return the appropriate StreamProcessor instance.
   */
  protected abstract createStreamProcessor(
    options: VitalLensOptions,
    getConfig: () => MethodConfig,
    frameIterator: IFrameIterator,
    bufferManager: BufferManager,
    faceDetectionWorker: IFaceDetectionWorker | null,
    methodHandler: MethodHandler,
    onPredict: (result: VitalLensResult) => Promise<void>,
    onNoFace: () => Promise<void>,
    onStreamReset: () => Promise<void>,
    onFaceDetected?: (
      face: {
        coordinates: [number, number, number, number];
        confidence: number;
      } | null
    ) => void,
    detectorHooks?: DetectorHooks
  ): IStreamProcessor;

  /**
   * Creates the appropriate method handler based on the options.
   * @param options - Configuration options.
   * @returns The method handler instance.
   */
  protected createMethodHandler(options: VitalLensOptions): MethodHandler {
    const requestMode = options.requestMode || 'rest';
    const dependencies = {
      restClient:
        options.method.startsWith('vitallens') && requestMode === 'rest'
          ? this.createRestClient(
              this.options.apiKey ?? '',
              this.options.proxyUrl
            )
          : undefined,
    };
    return MethodHandlerFactory.createHandler(options, dependencies);
  }

  /**
   * Sets a MediaStream, an HTMLVideoElement, or both for live stream processing.
   * @param stream - MediaStream to process (optional).
   * @param videoElement - HTMLVideoElement to use for processing (optional).
   */
  async setVideoStream(
    stream?: MediaStream,
    videoElement?: HTMLVideoElement
  ): Promise<void> {
    const core = await getCore();
    await this.methodHandler.init();
    if (!this.session) {
      this.session = new Session(
        core,
        this.methodHandler.getConfig(),
        this.options
      );
    }
    if (!isBrowser) {
      throw new Error(
        'setVideoStream is not supported yet in the Node environment.'
      );
    }
    if (!this.frameIteratorFactory) {
      throw new Error('FrameIteratorFactory is not initialized.');
    }
    if (this.streamProcessor) {
      throw new Error(
        'A video stream has already been set. Only one video stream is supported at a time - call stopVideoStream() to remove.'
      );
    }

    const frameIterator = this.frameIteratorFactory.createStreamFrameIterator(
      stream,
      videoElement
    );

    this.stageTimer.mark('modelsReady');
    this.watchStreamStartup();
    this.streamProcessor = this.createStreamProcessor(
      this.options,
      () => this.methodHandler.getConfig(),
      frameIterator,
      this.bufferManager,
      this.faceDetectionWorker,
      this.methodHandler,
      async (incrementalResult) => {
        // onPredict - process and dispatch incremental result unless paused
        if (this.isProcessing()) {
          const processedResult = await this.session!.processIncrementalResult(
            incrementalResult,
            this.options.waveformMode || 'incremental',
            true // ensure it returns the result
          );
          if (processedResult) {
            this.stageTimer.mark('firstResult', 'firstFace');
            this.dispatchEvent('vitals', processedResult);
          }
        }
      },
      async () => {
        // onNoFace - reset the vitals estimate manager and dispatch empty result
        this.session!.reset();
        this.dispatchEvent('vitals', this.session!.getEmptyResult());
        this.dispatchEvent('faceDetected', null);
      },
      async () => {
        // onStreamReset - dispatch a public event so the UI can react.
        this.dispatchEvent('streamReset', {
          message: 'Connection unstable. Stream is resetting.',
        });
      },
      (face) => {
        if (face && this.stageTimer.mark('firstFace') !== null) {
          this.stageTimer.watch(
            'firstResult',
            SLOW_FIRST_RESULT_MS,
            'firstFace'
          );
        }
        this.dispatchEvent('faceDetected', face);
      },
      {
        isReady: () => this.detectorReady,
        recreateWorker: () => {
          this.detectorReady = false;
          const worker = this.createFaceDetectionWorker();
          this.faceDetectionWorker = worker;
          this.watchWorkerReady(worker);
          return worker;
        },
        onStatus: (status) => this.dispatchEvent('status', status),
        report: (stage, ms) =>
          this.stageTimer.report(
            stage === 'detection' ? 'face detection' : 'API request',
            ms,
            stage === 'detection' ? SLOW_DETECTION_MS : SLOW_API_REQUEST_MS
          ),
      }
    );
  }

  /**
   * Sets whether API inference is enabled.
   */
  setInferenceEnabled(enabled: boolean): void {
    if (this.streamProcessor) {
      this.streamProcessor.setInferenceEnabled(enabled);
    }
  }

  /**
   * Starts processing for live streams or resumes if paused.
   */
  startVideoStream(): void {
    if (!this.isProcessing()) {
      this.streamProcessor!.start().catch((error) => {
        console.warn('Could not start video stream:', error);
        this.dispatchEvent('status', {
          stage: 'startFailed',
          reason: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }

  /**
   * Pauses processing for live streams, including frame capture and predictions.
   */
  pauseVideoStream(): void {
    if (this.isProcessing()) {
      this.streamProcessor!.stop();
      this.session?.reset();
    }
  }

  /**
   * Stops all ongoing processing and clears resources.
   */
  stopVideoStream(): void {
    if (this.streamProcessor) {
      this.streamProcessor.stop();
      this.streamProcessor = null;
    }
    this.session?.reset();
  }

  /**
   * Resets internal state.
   */
  reset(): void {
    this.session?.reset();
    if (this.streamProcessor) {
      // If streaming, let the processor handle the reset (clears ROI + Buffers)
      this.streamProcessor.reset();
    } else if (this.bufferManager) {
      // Fallback for file mode or uninitialized stream
      this.bufferManager.cleanup();
    }
  }

  /**
   * Processes a video file or input.
   * @param videoInput - The video input to process (string, File, or Blob).
   * @returns The results after processing the video.
   */
  async processVideoFile(videoInput: VideoInput): Promise<VitalLensResult> {
    const core = await getCore();
    await this.methodHandler.init();
    if (!this.session) {
      this.session = new Session(
        core,
        this.methodHandler.getConfig(),
        this.options
      );
    }
    if (!this.frameIteratorFactory) {
      throw new Error('FrameIteratorFactory is not initialized.');
    }

    if (!this.ffmpeg) {
      this.ffmpeg = this.createFFmpegWrapper();
    }

    const frameIterator = this.frameIteratorFactory.createFileFrameIterator(
      videoInput,
      this.ffmpeg,
      this.faceDetectionWorker
    );

    this.dispatchEvent('fileProgress', 'Detecting faces...');

    await frameIterator.start();

    let chunkCounter = 1;
    const iterator = frameIterator[Symbol.asyncIterator]();

    while (true) {
      this.dispatchEvent(
        'fileProgress',
        `Loading video for chunk ${chunkCounter}...`
      );
      const { value: framesChunk, done } = await iterator.next();
      if (done) break;

      this.dispatchEvent(
        'fileProgress',
        `Estimating vitals for chunk ${chunkCounter}...`
      );
      const incrementalResult = await this.methodHandler.process(
        framesChunk,
        'file',
        this.bufferManager.getState() ?? undefined,
        undefined
      );

      if (incrementalResult) {
        if (incrementalResult.state) {
          this.bufferManager.setState(
            new Float32Array(incrementalResult.state.data)
          );
        }
        // Feed the chunk into Wasm to accumulate in the buffer
        await this.session.processIncrementalResult(
          incrementalResult,
          'incremental',
          false
        );
      }
      chunkCounter++;
    }

    // Trigger the final Global calculation on the accumulated buffer
    const result = await this.session.getResult();

    await this.methodHandler.cleanup();
    this.session.reset();

    return result;
  }

  /**
   * Returns the vital signs supported by the currently resolved model.
   * @returns An array of supported vital sign keys.
   */
  getSupportedVitals(): Vital[] {
    return this.methodHandler.getConfig().supportedVitals || [];
  }

  /**
   * Adds an event listener for a specific event.
   * @param event - Event name (e.g., 'vitals').
   * @param listener - Callback to invoke when the event is emitted.
   */
  addEventListener(event: string, listener: (data: unknown) => void): void {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(listener);
  }

  /**
   * Removes an event listener for a specific event.
   * @param event - Event name (e.g., 'vitals')
   */
  removeEventListener(event: string): void {
    if (this.eventListeners[event]) {
      delete this.eventListeners[event];
    }
  }

  /**
   * Stop worker and dispose of all resources
   */
  async dispose(): Promise<void> {
    this.stageTimer.dispose();
    // Terminate the face detection worker if it exists.
    if (this.faceDetectionWorker) {
      await this.faceDetectionWorker.terminate();
      this.faceDetectionWorker = null;
    }
    // Clean up ffmpeg, streamProcessor, etc.
    if (this.ffmpeg) {
      this.ffmpeg.cleanup();
      this.ffmpeg = null;
    }
    if (this.streamProcessor) {
      this.streamProcessor.stop();
      this.streamProcessor = null;
    }
    // Reset any internal state.
    this.bufferManager.cleanup();
    this.session?.reset();
  }

  /**
   * Dispatches an event to all registered listeners.
   * @param event - Event name.
   * @param data - Data to pass to the listeners.
   */
  private dispatchEvent(event: string, data: unknown): void {
    this.eventListeners[event]?.forEach((listener) => listener(data));
  }

  /**
   * Returns `true` if streamProcessor is not null and actively processing.
   * @returns `true` if streamProcessor is not null and actively processing.
   */
  private isProcessing(): boolean {
    return this.streamProcessor !== null && this.streamProcessor.isProcessing();
  }
}
