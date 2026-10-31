import tf from 'tfjs-provider';
import { Frame } from './Frame';
import { FrameIteratorBase } from './FrameIterator.base';
import { FRAME_INTERVAL_TOLERANCE } from '../config/constants';

/**
 * Counts of stream frames that did not reach the processing loop.
 */
export interface FrameStats {
  delivered: number;
  // Frames presented by the video element without a callback (e.g. main thread busy).
  missed: number;
  // Frames captured but replaced by a newer one before the loop asked for them.
  overwritten: number;
}

/**
 * Frame iterator for MediaStreams (e.g., live video from a webcam).
 * Uses requestVideoFrameCallback where available: one frame per captured video frame,
 * stamped with its capture time. Otherwise polls the video element.
 */
export class StreamFrameIterator extends FrameIteratorBase {
  private videoElement: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private useVideoFrameCallback = false;
  private callbackHandle: number | null = null;
  private frameInterval = 0; // In seconds
  private pendingFrame: Frame | null = null;
  private waiter: ((frame: Frame | null) => void) | null = null;
  private lastPresentedFrames: number | null = null;
  private lastDeliveredTime: number | null = null; // In seconds
  private mediaTimeOffset: number | null = null; // In seconds
  private stats: FrameStats = { delivered: 0, missed: 0, overwritten: 0 };

  constructor(stream?: MediaStream, existingVideoElement?: HTMLVideoElement) {
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
        throw new Error(
          'Existing video element must have a valid MediaStream assigned to srcObject.'
        );
      }
      this.stream = existingVideoElement.srcObject as MediaStream;
    } else {
      throw new Error(
        'Either a MediaStream or an existing HTMLVideoElement must be provided.'
      );
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

    this.isClosed = false;
    this.lastPresentedFrames = null;
    this.lastDeliveredTime = null;
    this.mediaTimeOffset = null;
    this.stats = { delivered: 0, missed: 0, overwritten: 0 };
    this.useVideoFrameCallback =
      typeof this.videoElement.requestVideoFrameCallback === 'function';
    if (this.useVideoFrameCallback) {
      this.scheduleVideoFrameCallback();
    }
  }

  isFramePaced(): boolean {
    return this.useVideoFrameCallback;
  }

  /**
   * Sets the minimum time between delivered frames.
   * @param seconds - Target frame interval in seconds.
   */
  setFrameInterval(seconds: number): void {
    this.frameInterval = seconds;
  }

  getFrameStats(): FrameStats {
    return { ...this.stats };
  }

  private scheduleVideoFrameCallback(): void {
    this.callbackHandle = this.videoElement!.requestVideoFrameCallback(
      (now, metadata) => this.onVideoFrame(now, metadata)
    );
  }

  /**
   * Grabs the frame the callback was invoked for, unless it comes too soon after
   * the last delivered frame.
   */
  private onVideoFrame(
    now: DOMHighResTimeStamp,
    metadata: VideoFrameCallbackMetadata
  ): void {
    if (this.isClosed || !this.videoElement) return;
    this.scheduleVideoFrameCallback();

    if (this.lastPresentedFrames !== null) {
      this.stats.missed += Math.max(
        0,
        metadata.presentedFrames - this.lastPresentedFrames - 1
      );
    }
    this.lastPresentedFrames = metadata.presentedFrames;

    const timestamp = this.frameTimestamp(now, metadata);
    if (
      this.lastDeliveredTime !== null &&
      timestamp - this.lastDeliveredTime <
        this.frameInterval * FRAME_INTERVAL_TOLERANCE
    ) {
      return;
    }
    const frame = this.grabFrame(timestamp);
    if (!frame) return;
    this.lastDeliveredTime = timestamp;
    this.stats.delivered++;

    if (this.waiter) {
      const resolve = this.waiter;
      this.waiter = null;
      resolve(frame);
    } else {
      if (this.pendingFrame) {
        this.pendingFrame.release();
        this.stats.overwritten++;
      }
      this.pendingFrame = frame;
    }
  }

  /**
   * Capture time in seconds on the performance.now() clock. Falls back to the
   * media time, shifted onto that clock at the first frame.
   */
  private frameTimestamp(
    now: DOMHighResTimeStamp,
    metadata: VideoFrameCallbackMetadata
  ): number {
    if (metadata.captureTime !== undefined) {
      return metadata.captureTime / 1000;
    }
    this.mediaTimeOffset ??= now / 1000 - metadata.mediaTime;
    return metadata.mediaTime + this.mediaTimeOffset;
  }

  private grabFrame(timestamp: number): Frame | null {
    const { videoWidth, videoHeight } = this.videoElement!;
    if (!videoWidth || !videoHeight) {
      return null;
    }
    const tensor = tf.tidy(() => {
      return tf.browser.fromPixels(this.videoElement!);
    });

    // Keep tensor for full frame
    return Frame.fromTensor(tensor, true, [timestamp]);
  }

  /**
   * Retrieves the next frame from the video stream.
   * @returns A promise resolving to the next frame or null if the iterator is closed.
   */
  async next(): Promise<Frame | null> {
    if (this.isClosed || !this.videoElement) {
      return null;
    }

    if (this.useVideoFrameCallback) {
      if (this.pendingFrame) {
        const frame = this.pendingFrame;
        this.pendingFrame = null;
        return frame;
      }
      return new Promise((resolve) => {
        this.waiter = resolve;
      });
    }

    // Fallback: may read the same video frame twice or skip frames, and the
    // timestamp is the time of the grab, not of the capture.
    return this.grabFrame(performance.now() / 1000);
  }

  /**
   * Stops the iterator by pausing the video element and stopping the stream.
   */
  stop(): void {
    super.stop();
    if (this.videoElement) {
      if (this.callbackHandle !== null) {
        this.videoElement.cancelVideoFrameCallback(this.callbackHandle);
      }
      this.videoElement.pause();
    }
    this.callbackHandle = null;
    this.pendingFrame?.release();
    this.pendingFrame = null;
    this.waiter?.(null);
    this.waiter = null;
    this.isClosed = true;
  }
}
