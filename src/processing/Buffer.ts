import { MethodConfig } from '../config/methodsConfig';
import { ROI } from '../types/core';
import { Frame } from './Frame';

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
   * @param frame - The frame to add.
   * @param timestamp - The timestamp of the frame.
   */
  async add(frame: Frame, timestamp: number): Promise<void> {
    const processedFrame = await this.preprocess(frame, this.roi, this.methodConfig);
    
    this.buffer.set(timestamp, processedFrame);

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
   * @param hasState - Whether state is available
   * @returns An array of consumed frames.
   */
  consume(hasState: boolean): Frame[] {
    const keys = Array.from(this.buffer.keys()).sort((a, b) => a - b);
    const minWindowLength = (this.methodConfig.minWindowLengthState && hasState)
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
   * @param frame - The frame to preprocess.
   * @param roi - The roi.
   * @param methodConfig - The method configuration.
   */
  protected abstract preprocess(frame: Frame, roi: ROI, methodConfig: MethodConfig): Promise<Frame>;
}
