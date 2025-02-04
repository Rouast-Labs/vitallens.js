import { BufferManager } from '../processing/BufferManager';
import { StreamProcessor } from '../processing/StreamProcessor';
import { MethodHandler } from '../methods/MethodHandler';
import { MethodHandlerFactory } from '../methods/MethodHandlerFactory';
import { VitalLensOptions, VitalLensResult, VideoInput, MethodConfig } from '../types/core';
import { IFrameIteratorFactory } from '../types/IFrameIteratorFactory';
import { IVitalLensController } from '../types/IVitalLensController';
import { METHODS_CONFIG } from '../config/methodsConfig';
import { VitalsEstimateManager } from '../processing/VitalsEstimateManager';
import { IFaceDetector } from '../types/IFaceDetector';
import { isBrowser } from '../utils/env';
import { IRestClient } from '../types/IRestClient';
import { IWebSocketClient } from '../types/IWebSocketClient';

/**
 * Base class for VitalLensController, managing frame processing, buffering,
 * and predictions for both file-based and live stream scenarios.
 */
export abstract class VitalLensControllerBase implements IVitalLensController {
  protected frameIteratorFactory: IFrameIteratorFactory | null = null;
  protected bufferManager: BufferManager;
  protected streamProcessor: StreamProcessor | null = null;
  protected methodHandler: MethodHandler;
  protected methodConfig: MethodConfig;
  protected vitalsEstimateManager: VitalsEstimateManager;
  protected faceDetector: IFaceDetector;
  protected eventListeners: { [event: string]: ((data: any) => void)[] } = {};

  constructor(protected options: VitalLensOptions) {
    this.methodConfig = METHODS_CONFIG[this.options.method]
    this.bufferManager = new BufferManager();
    this.methodHandler = this.createMethodHandler(this.options);
    this.frameIteratorFactory = this.createFrameIteratorFactory(this.options);
    this.vitalsEstimateManager = new VitalsEstimateManager(this.methodConfig, this.options);
    this.faceDetector = this.createFaceDetector();
  }

  /**
   * Subclasses must return the appropriate FrameIteratorFactory instance.
   */
  protected abstract createFrameIteratorFactory(options: VitalLensOptions): IFrameIteratorFactory;

  /**
   * Subclasses must return the appropriate FaceDetector instance.
   */
  protected abstract createFaceDetector(): IFaceDetector;

  /**
   * Subclasses must return the appropriate RestClient instance.
   */
  protected abstract createRestClient(apiKey: string): IRestClient;

  /**
   * Subclasses must return the appropriate WebSocketClient instance.
   */
  protected abstract createWebSocketClient(apiKey: string): IWebSocketClient;  

  /**
   * Creates the appropriate method handler based on the options.
   * @param options - Configuration options.
   * @returns The method handler instance.
   */
  protected createMethodHandler(options: VitalLensOptions): MethodHandler {
    if (options.method === 'vitallens' && !options.apiKey) {
      throw new Error(
        'An API key is required to use method=vitallens, but was not provided. ' +
        'Get one for free at https://www.rouast.com/api.'
      );
    }
    const requestMode = options.requestMode || 'rest'; // Default to REST
    const dependencies = {
      webSocketClient: options.method === 'vitallens' && requestMode === 'websocket'
        ? this.createWebSocketClient(this.options.apiKey!)
        : undefined,
      restClient: options.method === 'vitallens' && requestMode === 'rest'
        ? this.createRestClient(this.options.apiKey!)
        : undefined
    };
    return MethodHandlerFactory.createHandler(options, dependencies);
  }

  /**
   * Sets a MediaStream, an HTMLVideoElement, or both for live stream processing.
   * @param stream - MediaStream to process (optional).
   * @param videoElement - HTMLVideoElement to use for processing (optional).
   */
  async setVideoStream(stream?: MediaStream, videoElement?: HTMLVideoElement): Promise<void> {
    if (!isBrowser) throw new Error('setVideoStream is not supported yet in the Node environment.');
    if (!this.frameIteratorFactory) throw new Error('FrameIteratorFactory is not initialized.');
    if (this.streamProcessor) throw new Error('A video stream has already been set. Only one video stream is supported at a time - call stopVideoStream() to remove.');
    
    if (!this.options.globalRoi) await this.faceDetector.load();

    const frameIterator = this.frameIteratorFactory.createStreamFrameIterator(stream, videoElement);

    this.streamProcessor = new StreamProcessor(
      this.options,
      this.methodConfig,
      frameIterator,
      this.bufferManager,
      this.faceDetector,
      this.methodHandler,
      async (incrementalResult) => {
        // onPredict - process and dispatch incremental result unless paused
        if (this.isProcessing()) {
          const result = await this.vitalsEstimateManager.processIncrementalResult(incrementalResult, frameIterator.getId(), "windowed");
          this.dispatchEvent('vitals', result);
        }
      },
      async () => {
        // onNoFace - reset the vitals estimate manager and dispatch empty result
        this.vitalsEstimateManager.reset(frameIterator.getId());
        this.dispatchEvent('vitals', this.vitalsEstimateManager.getEmptyResult());
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
    if (!this.frameIteratorFactory) throw new Error('FrameIteratorFactory is not initialized.');

    await this.methodHandler.init();
    await this.faceDetector.load();

    const frameIterator = this.frameIteratorFactory.createFileFrameIterator(videoInput, this.methodConfig, this.faceDetector);
    await frameIterator.start();
    for await (const framesChunk of frameIterator) {
      const incrementalResult = await this.methodHandler.process(framesChunk, this.bufferManager.getState());
      if (incrementalResult) {
        if (incrementalResult.state) this.bufferManager.setState(new Float32Array(incrementalResult.state.data));
        await this.vitalsEstimateManager.processIncrementalResult(incrementalResult, frameIterator.getId(), "complete");   
      }
    }

    const result = await this.vitalsEstimateManager.getResult(frameIterator.getId());

    await this.methodHandler.cleanup();
    this.vitalsEstimateManager.reset(frameIterator.getId());

    return result;
  }

  /**
   * Adds an event listener for a specific event.
   * @param event - Event name (e.g., 'vitals').
   * @param listener - Callback to invoke when the event is emitted.
   */
  addEventListener(event: string, listener: (data: any) => void): void {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(listener);
  }

  /**
   * Removes and event listener for a specific event.
   * @param event - Event name (e.g., 'vitals')
   */
  removeEventListener(event: string): void {
    if (this.eventListeners[event]) {
      delete this.eventListeners[event];
    }
  }

  /**
   * Dispatches an event to all registered listeners.
   * @param event - Event name.
   * @param data - Data to pass to the listeners.
   */
  private dispatchEvent(event: string, data: any): void {
    this.eventListeners[event]?.forEach((listener) => listener(data));
  }
  
  /**
   * Returns `true` if streamProcessor is not null and actively processing
   * @returns `true` if streamProcessor is not null and actively processing
   */
  private isProcessing() {
    return this.streamProcessor !== null && this.streamProcessor.isProcessing();
  }
}
