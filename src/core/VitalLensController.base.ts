import { BufferManager } from '../processing/BufferManager';
import { StreamProcessor } from '../processing/StreamProcessor';
import { MethodHandler } from '../methods/MethodHandler';
import { MethodHandlerFactory } from '../methods/MethodHandlerFactory';
import { WebSocketClient } from '../utils/WebSocketClient';
import { VitalLensOptions, VitalLensResult, VideoInput } from '../types/core';
import { IFrameIteratorFactory } from '../types/IFrameIteratorFactory';
import { IVitalLensController } from '../types/IVitalLensController';
import { API_ENDPOINT } from '../config/constants';
import { MethodConfig, METHODS_CONFIG } from '../config/methodsConfig';
import { mergeFrames } from '../utils/frameOps';
import { VitalsEstimateManager } from '../processing/VitalsEstimateManager';

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
  private processing = false;
  protected eventListeners: { [event: string]: ((data: any) => void)[] } = {};

  constructor(protected options: VitalLensOptions) {
    this.methodConfig = METHODS_CONFIG[this.options.method]
    
    this.bufferManager = new BufferManager();
    
    this.methodHandler = this.createMethodHandler(this.options);
    this.frameIteratorFactory = this.createFrameIteratorFactory(this.options);
    this.vitalsEstimateManager = new VitalsEstimateManager(this.methodConfig, this.options);
  }

  /**
   * Subclasses must return the appropriate FrameIteratorFactory instance.
   */
  protected abstract createFrameIteratorFactory(options: VitalLensOptions): IFrameIteratorFactory;

  /**
   * Creates the appropriate method handler based on the options.
   * @param options - Configuration options.
   * @returns The method handler instance.
   */
  protected createMethodHandler(options: VitalLensOptions): MethodHandler {
    const dependencies = {
      webSocketClient: options.method === 'vitallens'
        ? new WebSocketClient(API_ENDPOINT)
        : undefined,
    };
    return MethodHandlerFactory.createHandler(options, dependencies);
  }

  /**
   * Adds a MediaStream, an HTMLVideoElement, or both for live stream processing.
   * @param stream - MediaStream to process (optional).
   * @param videoElement - HTMLVideoElement to use for processing (optional).
   */
  async addStream(stream?: MediaStream, videoElement?: HTMLVideoElement): Promise<void> {
    if (!this.frameIteratorFactory) throw new Error('FrameIteratorFactory is not initialized.');

    const frameIterator = this.frameIteratorFactory.createStreamFrameIterator(stream, videoElement);

    this.streamProcessor = new StreamProcessor(
      this.options,
      this.methodConfig,
      frameIterator,
      this.bufferManager,
      async (frames) => {
        const framesChunk = mergeFrames(frames);
        framesChunk.retain();
        const incrementalResult = await this.methodHandler.process(
          framesChunk,
          this.bufferManager.getState()
        );
        framesChunk.release();
        this.bufferManager.setState(incrementalResult.state);
        
        const result = await this.vitalsEstimateManager.processIncrementalResult(incrementalResult, frameIterator.getId(), "aggregated");        
        
        this.dispatchEvent('vitals', result);
      }
    );

    await this.streamProcessor.start();
  }

  /**
   * Processes a video file or input.
   * @param videoInput - The video input to process (string, File, or Blob).
   * @returns The results after processing the video.
   */
  async processFile(videoInput: VideoInput): Promise<VitalLensResult> {
    if (!this.frameIteratorFactory) throw new Error('FrameIteratorFactory is not initialized.');

    const frameIterator = this.frameIteratorFactory.createFileFrameIterator(videoInput, this.methodConfig);

    for await (const framesChunk of frameIterator) {
      framesChunk.retain();
      const incrementalResult = await this.methodHandler.process(framesChunk, this.bufferManager.getState());
      framesChunk.release();
      this.bufferManager.setState(incrementalResult.state);
      await this.vitalsEstimateManager.processIncrementalResult(incrementalResult, frameIterator.getId(), "complete");        
    }

    return await this.vitalsEstimateManager.getResult(frameIterator.getId());
  }

  /**
   * Starts processing for live streams or resumes if paused.
   */
  start(): void {
    if (!this.processing && this.streamProcessor) {
      this.streamProcessor.resume();
      this.processing = true;
    }
  }

  /**
   * Pauses processing for live streams, including frame capture and predictions.
   */
  pause(): void {
    if (this.processing && this.streamProcessor) {
      this.streamProcessor.pause();
      this.processing = false;
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
