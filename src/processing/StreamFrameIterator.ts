import { Frame, VitalLensOptions } from '../types/core';
import { FrameIteratorBase } from './FrameIterator.base';
import { browser, tidy } from '@tensorflow/tfjs-core';

/**
 * Frame iterator for MediaStreams (e.g., live video from a webcam).
 */
export class StreamFrameIterator extends FrameIteratorBase {
  private videoElement: HTMLVideoElement | null = null;

  constructor(
    private stream: MediaStream,
    private options: VitalLensOptions,
    existingVideoElement?: HTMLVideoElement
  ) {
    super();
    this.videoElement = existingVideoElement || document.createElement('video');
    
    if (!existingVideoElement) {
      this.videoElement.srcObject = this.stream;
      this.videoElement.muted = true;
      this.videoElement.playsInline = true;
    }
  }

  /**
   * Starts the iterator by initializing the video element and playing the stream.
   */
  async start(): Promise<void> {
    if (!this.videoElement) {
      throw new Error('Video element is not initialized.');
    }
    await this.videoElement.play();
  }

  /**
   * Retrieves the next frame from the video stream.
   * @returns A promise resolving to the next frame or null if the iterator is closed.
   */
  async next(): Promise<Frame | null> {
    if (this.isClosed || !this.videoElement) {
      return null;
    }

    const { videoWidth, videoHeight } = this.videoElement;
    if (!videoWidth || !videoHeight) {
      return null;
    }

    return tidy(() => {
      // TODO: Does this work with WebRTC stream?
      const tensor = browser.fromPixels(this.videoElement!);

      if (this.options.roi) {
        const { x, y, width, height } = this.options.roi;
        return tensor.slice([y, x, 0], [height, width, 3]);
      }

      // TODO: Resize if necessary
      
      return {
        data: tensor,
        timestamp: // TODO
      };
    });
  }

  /**
   * Stops the iterator by pausing the video element and stopping the stream.
   */
  stop(): void {
    super.stop();
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.srcObject = null;
    }
    this.stream.getTracks().forEach((track) => track.stop());
  }
}
