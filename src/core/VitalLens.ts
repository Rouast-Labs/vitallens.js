import { VitalLensController } from './VitalLensController';
import { VitalLensOptions, VitalLensResult } from '../types/core';

/**
 * Main API entry point for the VitalLens library.
 */
export class VitalLens {
  private controller: VitalLensController;
  private isProcessing = false;

  /**
   * Initializes the VitalLens instance with the provided options.
   * @param options - Configuration options for the library.
   */
  constructor(private options: VitalLensOptions) {
    this.controller = new VitalLensController(options);
  }

  /**
   * Starts processing for live streams.
   */
  start(): void {
    if (!this.isProcessing) {
      this.isProcessing = true;
      this.startProcessingLoop();
    }
  }

  /**
   * Stops all ongoing processing.
   */
  stop(): void {
    this.isProcessing = false;
    this.controller.stop();
  }

  /**
   * Starts processing from a MediaStream.
   * @param stream - The MediaStream to process.
   * @param videoElement - Optional existing video element to use for processing.
   */
  async addStream(stream: MediaStream, videoElement?: HTMLVideoElement): Promise<void> {
    await this.controller.addStream(stream, videoElement);
  }

  /**
   * Processes a video file.
   * @param filePath - Path to the video file.
   * @returns The results after processing the video.
   */
  async processFile(filePath: string): Promise<VitalLensResult[]> {
    return this.controller.processFile(filePath);
  }

  /**
   * Registers an event listener for a specific event.
   * @param event - The event to listen to (e.g., 'vitals').
   * @param callback - The function to call when the event occurs.
   */
  addEventListener(event: string, callback: (data: any) => void): void {
    this.controller.addEventListener(event, callback);
  }

  /**
   * Internal method to start the processing loop for live streams.
   */
  private startProcessingLoop(): void {
    const loop = async () => {
      if (!this.isProcessing) return;

      try {
        await this.controller.processBuffer();
      } catch (error) {
        console.error('Error during processing:', error);
      } finally {
        requestAnimationFrame(loop);
      }
    };

    requestAnimationFrame(loop);
  }
}
