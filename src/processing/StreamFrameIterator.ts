import { VitalLensOptions } from '../types/core';
import { Frame } from './Frame';
import { FrameIteratorBase } from './FrameIterator.base';
import { browser, tidy } from '@tensorflow/tfjs-core';

/**
 * Frame iterator for MediaStreams (e.g., live video from a webcam).
 */
export class StreamFrameIterator extends FrameIteratorBase {
  private videoElement: HTMLVideoElement | null = null;

  constructor(
    stream?: MediaStream,
    existingVideoElement?: HTMLVideoElement,
    private options: VitalLensOptions,
  ) {
    super();

    // TODO: How to handle different scenarios where one of stream and existingVideoElement may be undefined

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

    const tensorData = tidy(() => {
      // TODO: Does this work with WebRTC stream?
      return browser.fromPixels(this.videoElement!);
    });

    return new Frame(tensorData, performance.now());
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
