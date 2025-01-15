import { MethodConfig } from '../config/methodsConfig';
import { ROI } from '../types/core';
import { Frame } from './Frame';

/**
 * An abstract class to manage buffering of frames.
 */
export abstract class Buffer {
  private buffer: Map<number, Frame> = new Map(); // Frame data mapped by timestep index

  constructor(
    private roi: ROI,
    private maxFrames: number,
    private minFrames: number = 0,
    private methodConfig: MethodConfig) {
    if (minFrames > maxFrames) {
      throw new Error('minFrames cannot be greater than maxFrames.');
    }
  }

  /**
   * Adds a frame to the buffer.
   * @param frame - The frame to add.
   * @param timestepIndex - The timestep index of the frame.
   */
  async add(frame: Frame, timestepIndex: number): Promise<void> {
    frame.retain(); // 3 (or 4 if in use by face detector)
    const processedFrame = await this.preprocess(frame, this.roi, this.methodConfig);
    frame.release(); // 2 (or 4 if in use by face detector)
    
    processedFrame.retain(); // 1
    this.buffer.set(timestepIndex, processedFrame);

    // Maintain the maximum buffer size
    while (this.buffer.size > this.maxFrames) {
      const oldestKey = Math.min(...this.buffer.keys());
      const oldFrame = this.buffer.get(oldestKey);
      this.buffer.delete(oldestKey);
      if (oldFrame) {
        oldFrame.release(); // 0
      }
    }
  }

  /**
   * Checks if the buffer is ready for processing.
   * @returns True if the buffer has enough frames, false otherwise.
   */
  isReady(): boolean {
    return this.buffer.size >= this.minFrames;
  }
  
  /**
   * Consumes frames from the buffer but retains the last `minFrames`.
   * @returns An array of consumed frames.
   */
  consume(): Frame[] {
    const keys = Array.from(this.buffer.keys()).sort((a, b) => a - b);
    const retainCount = Math.min(this.minFrames, this.buffer.size);
    const retainKeys = keys.slice(-retainCount);

    const consumedFrames = keys.map((key) => {
      const frame = this.buffer.get(key)!;
      if (!retainKeys.includes(key)) {
        // Do not release frames that are passed to the caller.
        // The caller will be instructed to "take over" our reference count.
        // When the caller is done it will release these frames.
        this.buffer.delete(key);
      } else {
        // Retain frames that are kept in the buffer.
        // When the caller is done with these frames, it will release them but we still have our reference.
        frame.retain(); 
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
    for (const frame of this.buffer.values()) {
      frame.release(); // 0
    }
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
