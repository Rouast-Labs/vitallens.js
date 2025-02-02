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
  private processing = false;
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
   * Adds a MediaStream, an HTMLVideoElement, or both for live stream processing.
   * @param stream - MediaStream to process (optional).
   * @param videoElement - HTMLVideoElement to use for processing (optional).
   */
  async addStream(stream?: MediaStream, videoElement?: HTMLVideoElement): Promise<void> {
    if (!isBrowser) throw new Error('addStream is not supported yet in the Node environment.');
    if (!this.frameIteratorFactory) throw new Error('FrameIteratorFactory is not initialized.');
    
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
        const result = await this.vitalsEstimateManager.processIncrementalResult(incrementalResult, frameIterator.getId(), "aggregated");
        this.dispatchEvent('vitals', result);
      }
    );
  }

  /**
   * Processes a video file or input.
   * @param videoInput - The video input to process (string, File, or Blob).
   * @returns The results after processing the video.
   */
  async processFile(videoInput: VideoInput): Promise<VitalLensResult> {
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

    await this.methodHandler.cleanup();

    return await this.vitalsEstimateManager.getResult(frameIterator.getId());
  }

  /**
   * Starts processing for live streams or resumes if paused.
   */
  start(): void {
    if (!this.processing && this.streamProcessor) {
      this.methodHandler.init();
      this.streamProcessor.start();
      this.processing = true;
    }
  }

  /**
   * Pauses processing for live streams, including frame capture and predictions.
   */
  pause(): void {
    if (this.processing && this.streamProcessor) {
      this.streamProcessor.stop();
      this.processing = false;
      this.methodHandler.cleanup();
    }
  }

  /**
   * Stops all ongoing processing and clears resources.
   */
  stop(): void {
    if (this.streamProcessor) {
      this.streamProcessor.stop();
      this.streamProcessor = null;
    }
    this.processing = false;
    this.bufferManager.cleanup();
    this.methodHandler.cleanup();
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
   * Dispatches an event to all registered listeners.
   * @param event - Event name.
   * @param data - Data to pass to the listeners.
   */
  private dispatchEvent(event: string, data: any): void {
    this.eventListeners[event]?.forEach((listener) => listener(data));
  }
}
