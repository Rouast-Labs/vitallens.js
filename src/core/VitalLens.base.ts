import { VitalLensOptions, VitalLensResult, VideoInput } from '../types/core';
import { IVitalLensController } from '../types/IVitalLensController';

/**
 * Base class for the VitalLens library, providing a unified API for file-based
 * and live stream video processing.
 */
export abstract class VitalLensBase {
  private controller: IVitalLensController;

  /**
   * Initializes the VitalLens instance with the provided options.
   * @param options - Configuration options for the library.
   */
  constructor(options: VitalLensOptions) {
    this.controller = this.createController(options);
  }

  /**
   * Subclasses must return the correct environment-specific VitalLensController instance.
   */
  protected abstract createController(options: VitalLensOptions): IVitalLensController;

  /**
   * Starts processing for live streams or resumes if paused.
   */
  start(): void {
    this.controller.start();
  }

  /**
   * Pauses processing for live streams, including frame capture and predictions.
   */
  pause(): void {
    this.controller.pause();
  }

  /**
   * Stops all ongoing processing and clears resources.
   */
  stop(): void {
    this.controller.stop();
  }

  /**
   * Adds a MediaStream, an HTMLVideoElement, or both for live stream processing.
   * @param stream - The MediaStream to process (optional).
   * @param videoElement - The HTMLVideoElement to use for processing (optional).
   */
  async addStream(stream?: MediaStream, videoElement?: HTMLVideoElement): Promise<void> {
    if (!stream && !videoElement) {
      throw new Error('You must provide either a MediaStream, an HTMLVideoElement, or both.');
    }
    await this.controller.addStream(stream, videoElement);
  }

  /**
   * Processes a video file or input.
   * @param videoInput - The video input to process (string, File, or Blob).
   * @returns The results after processing the video.
   */
  async processFile(videoInput: VideoInput): Promise<VitalLensResult[]> {
    return this.controller.processFile(videoInput);
  }

  /**
   * Registers an event listener for a specific event.
   * @param event - The event to listen to (e.g., 'vitals').
   * @param callback - The function to call when the event occurs.
   */
  addEventListener(event: string, callback: (data: any) => void): void {
    this.controller.addEventListener(event, callback);
  }
}
