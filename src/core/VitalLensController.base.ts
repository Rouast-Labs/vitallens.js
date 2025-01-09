import { FrameBuffer } from './FrameBuffer';
import { MethodHandlerFactory } from '../methods/MethodHandlerFactory';
import { MethodHandler } from '../methods/MethodHandler';
import { WebSocketClient } from '../utils/WebSocketClient';
import { VitalLensOptions, VitalLensResult } from '../types/core';
import { IVideoProcessor } from '../types/IVideoProcessor';
import { API_ENDPOINT } from '../config/constants';
import { IVitalLensController } from '../types/IVitalLensController';

export abstract class VitalLensControllerBase implements IVitalLensController {
  protected videoProcessor: IVideoProcessor | null = null;
  protected buffer: FrameBuffer;
  protected methodHandler: MethodHandler;
  protected processing = false;
  protected eventListeners: { [event: string]: ((data: any) => void)[] } = {};

  constructor(protected options: VitalLensOptions) {
    this.buffer = new FrameBuffer(options.fps);
    this.methodHandler = this.createMethodHandler(options);
    this.videoProcessor = this.createVideoProcessor(options);
  }

  /**
   * Subclasses must return the correct environment-specific VideoProcessor instance.
   */
  protected abstract createVideoProcessor(options: VitalLensOptions): IVideoProcessor;

  /**
   * Adds a MediaStream for processing.
   * @param stream - MediaStream to process.
   * @param existingVideoElement - Optional video element if the client is already rendering the stream.
   */
  async addStream(stream: MediaStream, videoElement?: HTMLVideoElement): Promise<void> {
    if (!this.videoProcessor) return;
    await this.videoProcessor.startStreamCapture(stream, (frame) => this.buffer.add(frame), videoElement);
  }

  /**
   * Consumes frames from the buffer, calls the method handler, triggers events.
   */
  async processBuffer(): Promise<void> {
    if (this.processing || !this.buffer.isReady()) return;
    this.processing = true;

    try {
      const frames = this.buffer.consume();
      const output = await this.methodHandler.process(frames, this.buffer.getState());
      this.buffer.setState(output.state);
      this.dispatchEvent('vitals', output);
    } finally {
      this.processing = false;
    }
  }

  /**
   * Processes a video file.
   * @param filePath - Path to the video file.
   * @returns The results after processing the video.
   */
  async processFile(filePath: string): Promise<VitalLensResult[]> {
    if (!this.videoProcessor) {
      this.videoProcessor = this.createVideoProcessor(this.options);
    }
  
    const frames = await this.videoProcessor.extractFramesFromFile(filePath);
  
    const result = await this.methodHandler.process(frames);
  
    // Ensure the result is always an array
    return Array.isArray(result) ? result : [result];
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
   * Stops all ongoing processing.
   */
  stop(): void {
    if (this.videoProcessor) {
      // this.videoProcessor.stopFrameCapture(); TODO
      this.videoProcessor = null;
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
}
