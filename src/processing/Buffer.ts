import { MethodConfig, ROI } from '../types/core';
import { Frame } from './Frame';
import * as tf from '@tensorflow/tfjs';

/**
 * An abstract class to manage buffering of frames.
 */
export abstract class Buffer {
  private buffer: Map<number, Frame> = new Map(); // Frame data mapped by timestamp

  constructor(
    private roi: ROI,
    protected methodConfig: MethodConfig) {
  }

  /**
   * Adds a frame to the buffer.
   * @param tensor - The frame to add.
   * @param timestamp - The frame timestamp
   */
  async add(tensor: tf.Tensor3D, timestamp: number[]): Promise<void> {
    const processedFrame = await this.preprocess(tensor, timestamp, this.roi);
    const frameTime = timestamp[0];
    this.buffer.set(frameTime, processedFrame);

    // Maintain the maximum buffer size
    while (this.buffer.size > this.methodConfig.maxWindowLength) {
      const oldestKey = Math.min(...this.buffer.keys());
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
   * Consumes frames from the buffer but retains the last `minFrames`.
   * @returns An array of consumed frames.
   */
  consume(): Frame[] {
    const keys = Array.from(this.buffer.keys()).sort((a, b) => a - b);
    const minWindowLength = this.methodConfig.minWindowLengthState
      ? Math.min(this.methodConfig.minWindowLengthState, this.methodConfig.minWindowLength)
      : this.methodConfig.minWindowLength; 
    const retainCount = Math.min(minWindowLength-1, this.buffer.size);
    const retainKeys = keys.slice(-retainCount);

    const consumedFrames = keys.map((key) => {
      const frame = this.buffer.get(key)!;
      if (!retainKeys.includes(key)) {
        this.buffer.delete(key);
      }
      return frame;
    });

    this.buffer = new Map(retainKeys.map((key) => [key, this.buffer.get(key)!]));
    return consumedFrames;
  }

  /**
   * Clears the buffer.
   */
  clear(): void {
    this.buffer.clear();
  }

  /**
   * Abstract method for preprocessing a frame.
   * Must be implemented in subclasses.
   * @param tensor - The frame to preprocess.
   * @param timestamp - The timestamp of the frame.
   * @param roi - The region of interest for cropping.
   * @returns The processed frame.
   */
  protected abstract preprocess(tensor: tf.Tensor3D, timestamp: number[], roi: ROI): Promise<Frame>;
}
