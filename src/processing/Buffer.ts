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
   * Get the current buffer size.
   * @returns The size of the buffer.
   */
  size(): number {
    return this.buffer.size;
  }

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
   * Consumes a specific number of frames from the buffer and retains a specific overlap count.
   */
  async consume(takeCount: number, keepCount: number): Promise<Frame | null> {
    const keys = Array.from(this.buffer.keys()).sort((a, b) => a - b);
    if (keys.length === 0) return null;

    const consumedKeys = keys.slice(0, takeCount);
    const retainKeys = consumedKeys.slice(-keepCount);

    const consumedFrames = consumedKeys.map((key) => this.buffer.get(key)!);

    return mergeFrames(
      consumedFrames,
      !this.methodConfig.method.startsWith('vitallens')
    ).then((mergedFrame) => {
      for (const key of consumedKeys) {
        if (!retainKeys.includes(key)) {
          const frame = this.buffer.get(key);
          frame?.release();
          this.buffer.delete(key);
        }
      }
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
