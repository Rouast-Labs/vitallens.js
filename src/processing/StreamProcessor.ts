import { Frame } from '../types/core';
import { FrameBuffer } from './FrameBuffer';

/**
 * Manages the processing loop for live streams, including frame capture,
 * buffering, and triggering predictions.
 */
export class StreamProcessor {
  private isPaused = false;
  private isPredicting = false;

  constructor(
    private frameIterator: AsyncIterable<Frame>,
    private frameBuffer: FrameBuffer,
    private onPredict: (frames: Frame[]) => Promise<void>
  ) {}

  /**
   * Starts the stream processing loop.
   */
  async start(): Promise<void> {
    this.isPaused = false;
    const iterator = this.frameIterator[Symbol.asyncIterator]();

    const processFrames = async () => {
      while (!this.isPaused) {
        // TODO: We should only sample the video stream at given frame rate
        // TODO: Get that frame rate from methodsConfig
        const { value: frame, done } = await iterator.next();
        if (done || this.isPaused) break;

        if (frame) {
          this.frameBuffer.add(frame);
          if (this.frameBuffer.isReady() && !this.isPredicting) {
            this.isPredicting = true;
            const frames = this.frameBuffer.consume();
            this.onPredict(frames).finally(() => {
              this.isPredicting = false;
            });
          }
        }
      }
    };

    processFrames().catch((error) => {
      console.error('Error in stream processing loop:', error);
    });
  }

  /**
   * Pauses the processing loop.
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * Resumes the processing loop.
   */
  resume(): void {
    if (this.isPaused) {
      this.isPaused = false;
      this.start();
    }
  }

  /**
   * Stops the processing loop and clears the buffer.
   */
  stop(): void {
    this.isPaused = true;
    this.frameBuffer.clear();
  }
}
