import { FrameBuffer } from '../processing/FrameBuffer';
import { StreamProcessor } from '../processing/StreamProcessor';
import { MethodHandler } from '../methods/MethodHandler';
import { MethodHandlerFactory } from '../methods/MethodHandlerFactory';
import { WebSocketClient } from '../utils/WebSocketClient';
import { VitalLensOptions, VitalLensResult, VideoInput } from '../types/core';
import { IVideoInputProcessor } from '../types/IVideoInputProcessor';
import { IVitalLensController } from '../types/IVitalLensController';
import { API_ENDPOINT } from '../config/constants';
import { METHODS_CONFIG } from '../config/methodsConfig';

/**
 * Base class for VitalLensController, managing frame processing, buffering,
 * and predictions for both file-based and live stream scenarios.
 */
export abstract class VitalLensControllerBase implements IVitalLensController {
  protected videoInputProcessor: IVideoInputProcessor | null = null;
  protected frameBuffer: FrameBuffer;
  protected streamProcessor: StreamProcessor | null = null;
  protected methodHandler: MethodHandler;
  private processing = false;
  protected eventListeners: { [event: string]: ((data: any) => void)[] } = {};

  constructor(protected options: VitalLensOptions) {
    this.frameBuffer = new FrameBuffer(
      METHODS_CONFIG[this.options.method].maxWindowLength,
      METHODS_CONFIG[this.options.method].minWindowLength,
    );
    this.methodHandler = this.createMethodHandler(this.options);
    this.videoInputProcessor = this.createVideoInputProcessor(this.options);
  }

  /**
   * Subclasses must return the appropriate VideoInputProcessor instance.
   */
  protected abstract createVideoInputProcessor(options: VitalLensOptions): IVideoInputProcessor;

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
    return MethodHandlerFactory.createHandler(options.method, options, dependencies);
  }

  /**
   * Adds a MediaStream, an HTMLVideoElement, or both for live stream processing.
   * @param stream - MediaStream to process (optional).
   * @param videoElement - HTMLVideoElement to use for processing (optional).
   */
  async addStream(stream?: MediaStream, videoElement?: HTMLVideoElement): Promise<void> {
    if (!this.videoInputProcessor) throw new Error('VideoInputProcessor is not initialized.');

    const frameIterator = this.videoInputProcessor.createStreamFrameIterator(stream, videoElement, this.options);

    this.streamProcessor = new StreamProcessor(
      frameIterator,
      this.frameBuffer,
      async (frames) => {
        const result = await this.methodHandler.process(frames, this.frameBuffer.getState());
        this.frameBuffer.setState(result.state); // Set state (only relevant for VitalLens API)
        this.dispatchEvent('vitals', result); // Emit event with results
      }
    );

    await this.streamProcessor.start();
  }

  /**
   * Processes a video file or input.
   * @param videoInput - The video input to process (string, File, or Blob).
   * @returns The results after processing the video.
   */
  async processFile(videoInput: VideoInput): Promise<VitalLensResult[]> {
    if (!this.videoInputProcessor) throw new Error('VideoInputProcessor is not initialized.');

    const frameIterator = this.videoInputProcessor.createFileFrameIterator(videoInput, this.options, METHODS_CONFIG[this.options.method]);

    const results: VitalLensResult[] = [];
    for await (const frames of frameIterator) {
      const result = await this.methodHandler.process(frames, this.frameBuffer.getState());
      this.frameBuffer.setState(result.state); // Update state (if relevant)
      results.push(result);
    }

    return results;
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
    this.frameBuffer.clear();
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
