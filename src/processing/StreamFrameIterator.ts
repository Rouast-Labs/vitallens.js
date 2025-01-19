import { Frame } from './Frame';
import { FrameIteratorBase } from './FrameIterator.base';
import { browser, tidy } from '@tensorflow/tfjs-core';

/**
 * Frame iterator for MediaStreams (e.g., live video from a webcam).
 */
export class StreamFrameIterator extends FrameIteratorBase {
  private videoElement: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;

  constructor(
    stream?: MediaStream,
    existingVideoElement?: HTMLVideoElement,
  ) {
    super();

    if (stream && existingVideoElement) {
      this.stream = stream;
      this.videoElement = existingVideoElement;
    } else if (stream) {
      this.stream = stream;
      this.videoElement = null; // Video element will not be managed
    } else if (existingVideoElement) {
      this.videoElement = existingVideoElement;
      if (!existingVideoElement.srcObject) {
        throw new Error('Existing video element must have a valid MediaStream assigned to srcObject.');
      }
      this.stream = existingVideoElement.srcObject as MediaStream;
    } else {
      throw new Error('Either a MediaStream or an existing HTMLVideoElement must be provided.');
    }
  }

  /**
   * Starts the iterator by initializing the video element and playing the stream.
   */
  async start(): Promise<void> {   
    if (!this.videoElement) {
      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = this.stream;
      this.videoElement.muted = true;
      this.videoElement.playsInline = true;
    }

    if (!this.videoElement.srcObject) {
      this.videoElement.srcObject = this.stream;
    }

    try {
      await this.videoElement.play();
    } catch (error) {
      console.error('Failed to start video playback:', error);
    }
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

    return new Frame(tensorData, [performance.now()/1000]);
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
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }
  }
}
