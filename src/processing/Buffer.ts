import { MethodConfig, ROI } from '../types/core';
import { mergeFrames } from '../utils/arrayOps';
import { Frame } from './Frame';

/**
 * An abstract class to manage buffering of frames.
 */
export abstract class Buffer {
  private buffer: Map<number, Frame> = new Map(); // Frame data mapped by timestamp

  constructor(
    protected roi: ROI,
    protected methodConfig: MethodConfig
  ) {}

  /**
   * Adds a frame to the buffer.
   * @param frame - The frame to add.
   * @param overrideRoi - Use this ROI instead of buffer ROI (optional).
   */
  async add(frame: Frame, overrideRoi?: ROI): Promise<void> {
    const processedFrame = await this.preprocess(frame, true, overrideRoi);
    const frameTime = frame.getTimestamp()[0];
    this.buffer.set(frameTime, processedFrame);

    // Maintain the maximum buffer size
    while (this.buffer.size > this.methodConfig.maxWindowLength) {
      const oldestKey = Math.min(...this.buffer.keys());
      const oldestFrame = this.buffer.get(oldestKey);
      if (oldestFrame) oldestFrame.release();
      this.buffer.delete(oldestKey);
    }
  }

  /**
   * Checks if the buffer is ready for processing.
   * @returns True if the buffer has enough frames, false otherwise.
   */
  isReady(): boolean {
    return this.buffer.size >= this.methodConfig.minWindowLength;
  }

  /**
   * Checks if the buffer is ready for processing given state.
   * @returns True if the buffer has enough frames given state, false otherwise.
   */
  isReadyState(): boolean {
    if (this.methodConfig.minWindowLengthState) {
      return this.buffer.size >= this.methodConfig.minWindowLengthState;
    } else {
      return this.isReady();
    }
  }

  /**
   * Consumes frames from the buffer but retains the last `minFrames`, returning a single merged Frame.
   * @returns A single merged Frame or null if no frames are available.
   */
  async consume(): Promise<Frame | null> {
    const keys = Array.from(this.buffer.keys()).sort((a, b) => a - b);
    if (keys.length === 0) {
      return null;
    }

    const minWindowLength = this.methodConfig.minWindowLengthState
      ? Math.min(
          this.methodConfig.minWindowLengthState,
          this.methodConfig.minWindowLength
        )
      : this.methodConfig.minWindowLength;
    const retainCount = Math.min(minWindowLength - 1, this.buffer.size);
    const retainKeys = keys.slice(-retainCount);

    // Extract frames to be consumed
    const consumedFrames = keys.map((key) => this.buffer.get(key)!);

    // Merge frames asynchronously
    return mergeFrames(
      consumedFrames,
      this.methodConfig.method.startsWith('vitallens')
    ).then((mergedFrame) => {
      // Release tensors of frames that are not retained
      for (const key of keys) {
        if (!retainKeys.includes(key)) {
          const frame = this.buffer.get(key);
          frame?.release();
          this.buffer.delete(key);
        }
      }

      // Keep only the retained frames
      this.buffer = new Map(
        retainKeys.map((key) => [key, this.buffer.get(key)!])
      );

      return mergedFrame;
    });
  }

  /**
   * Clears the buffer.
   */
  clear(): void {
    for (const frame of this.buffer.values()) {
      frame.release();
    }
    this.buffer.clear();
  }

  /**
   * Abstract method for preprocessing a frame.
   * Must be implemented in subclasses.
   * @param frame - The frame to preprocess.
   * @param keepTensor - Whether to keep the tensor in the resulting frame.
   * @param overrideRoi - Use this ROI instead of buffer ROI (optional).
   * @returns The processed frame.
   */
  protected abstract preprocess(
    frame: Frame,
    keepTensor: boolean,
    overrideRoi?: ROI
  ): Promise<Frame>;
}
