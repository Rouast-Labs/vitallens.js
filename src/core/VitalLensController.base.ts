import { BufferManager } from '../processing/BufferManager';
import { MethodHandler } from '../methods/MethodHandler';
import { MethodHandlerFactory } from '../methods/MethodHandlerFactory';
import {
  VitalLensOptions,
  VitalLensResult,
  VideoInput,
  MethodConfig,
} from '../types/core';
import { IVitalLensController } from '../types/IVitalLensController';
import { METHODS_CONFIG } from '../config/methodsConfig';
import { VitalsEstimateManager } from '../processing/VitalsEstimateManager';
import { isBrowser } from '../utils/env';
import { IRestClient } from '../types/IRestClient';
import { IWebSocketClient } from '../types/IWebSocketClient';
import { IStreamProcessor } from '../types/IStreamProcessor';
import { IFrameIterator } from '../types/IFrameIterator';
import { IFFmpegWrapper } from '../types/IFFmpegWrapper';
import { FrameIteratorFactory } from '../processing/FrameIteratorFactory';
import { IFaceDetectionWorker } from '../types/IFaceDetectionWorker';
import { VitalLensAPIKeyError } from '../utils/errors';

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
  protected ffmpeg: IFFmpegWrapper | null = null;
  protected vitalsEstimateManager: VitalsEstimateManager;
  protected eventListeners: { [event: string]: ((data: unknown) => void)[] } =
    {};

  constructor(protected options: VitalLensOptions) {
    this.methodConfig = METHODS_CONFIG[this.options.method];
    this.bufferManager = new BufferManager();
    this.methodHandler = this.createMethodHandler(options);
    this.frameIteratorFactory = new FrameIteratorFactory(options);
    this.vitalsEstimateManager = new VitalsEstimateManager(
      this.methodConfig,
      this.options,
      this.methodHandler.postprocess.bind(this.methodHandler)
    );
    if (options.globalRoi === undefined) {
      this.faceDetectionWorker = this.createFaceDetectionWorker();
    }
  }

  /**
   * Subclasses must return the appropriate RestClient instance.
   */
  protected abstract createRestClient(
    apiKey: string,
    proxyUrl?: string
  ): IRestClient;

  /**
   * Subclasses must return the appropriate WebSocketClient instance.
   */
  protected abstract createWebSocketClient(
    apiKey: string,
    proxyUrl?: string
  ): IWebSocketClient;

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
    methodConfig: MethodConfig,
    frameIterator: IFrameIterator,
    bufferManager: BufferManager,
    faceDetectionWorker: IFaceDetectionWorker | null,
    methodHandler: MethodHandler,
    onPredict: (result: VitalLensResult) => Promise<void>,
    onNoFace: () => Promise<void>
  ): IStreamProcessor;

  /**
   * Creates the appropriate method handler based on the options.
   * @param options - Configuration options.
   * @returns The method handler instance.
   */
  protected createMethodHandler(options: VitalLensOptions): MethodHandler {
    if (
      options.method === 'vitallens' &&
      !options.apiKey &&
      !options.proxyUrl
    ) {
      throw new VitalLensAPIKeyError();
    }
    // Temporarily disable WebSocket
    if (options.requestMode === 'websocket') {
      throw new Error(
        'WebSocket request mode is disabled for now. Please use requestMode=rest.'
      );
    }
    const requestMode = options.requestMode || 'rest'; // Default to REST
    const dependencies = {
      // webSocketClient:
      //   options.method === 'vitallens' && requestMode === 'websocket'
      //     ? this.createWebSocketClient(
      //         this.options.apiKey ?? '',
      //         this.options.proxyUrl
      //       )
      //     : undefined,
      restClient:
        options.method === 'vitallens' && requestMode === 'rest'
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

    this.streamProcessor = this.createStreamProcessor(
      this.options,
      this.methodConfig,
      frameIterator,
      this.bufferManager,
      this.faceDetectionWorker,
      this.methodHandler,
      async (incrementalResult) => {
        // onPredict - process and dispatch incremental result unless paused
        if (this.isProcessing()) {
          const result =
            await this.vitalsEstimateManager.processIncrementalResult(
              incrementalResult,
              frameIterator.getId(),
              'windowed',
              true,
              true
            );
          this.dispatchEvent('vitals', result);
        }
      },
      async () => {
        // onNoFace - reset the vitals estimate manager and dispatch empty result
        this.vitalsEstimateManager.reset(frameIterator.getId());
        this.dispatchEvent(
          'vitals',
          this.vitalsEstimateManager.getEmptyResult()
        );
      }
    );
  }

  /**
   * Starts processing for live streams or resumes if paused.
   */
  startVideoStream(): void {
    if (!this.isProcessing()) {
      this.streamProcessor!.start();
    }
  }

  /**
   * Pauses processing for live streams, including frame capture and predictions.
   */
  pauseVideoStream(): void {
    if (this.isProcessing()) {
      this.streamProcessor!.stop();
      this.vitalsEstimateManager.resetAll();
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
    this.vitalsEstimateManager.resetAll();
  }

  /**
   * Processes a video file or input.
   * @param videoInput - The video input to process (string, File, or Blob).
   * @returns The results after processing the video.
   */
  async processVideoFile(videoInput: VideoInput): Promise<VitalLensResult> {
    if (!this.frameIteratorFactory) {
      throw new Error('FrameIteratorFactory is not initialized.');
    }

    if (!this.ffmpeg) {
      this.ffmpeg = this.createFFmpegWrapper();
    }

    await this.methodHandler.init();

    const frameIterator = this.frameIteratorFactory.createFileFrameIterator(
      videoInput,
      this.methodConfig,
      this.ffmpeg,
      this.faceDetectionWorker
    );

    this.dispatchEvent('progress', 'Detecting faces...');

    await frameIterator.start();

    let chunkCounter = 1;
    const iterator = frameIterator[Symbol.asyncIterator]();

    // eslint-disable-next-line no-constant-condition
    while (true) {
      this.dispatchEvent(
        'progress',
        `Loading video for chunk ${chunkCounter}...`
      );
      const { value: framesChunk, done } = await iterator.next();
      if (done) break;

      this.dispatchEvent(
        'progress',
        `Estimating vitals for chunk ${chunkCounter}...`
      );
      const incrementalResult = await this.methodHandler.process(
        framesChunk,
        'file',
        this.bufferManager.getState() ?? undefined
      );

      if (incrementalResult) {
        if (incrementalResult.state) {
          this.bufferManager.setState(
            new Float32Array(incrementalResult.state.data)
          );
        }
        await this.vitalsEstimateManager.processIncrementalResult(
          incrementalResult,
          frameIterator.getId(),
          'complete',
          true,
          false
        );
      }
      chunkCounter++;
    }

    const result = await this.vitalsEstimateManager.getResult(
      frameIterator.getId()
    );

    await this.methodHandler.cleanup();
    this.vitalsEstimateManager.reset(frameIterator.getId());

    return result;
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
    this.vitalsEstimateManager.resetAll();
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
