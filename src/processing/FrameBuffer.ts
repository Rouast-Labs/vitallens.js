import { Frame, ROI } from '../types/core';

/**
 * A class to manage buffering of frames and handling recurrent state.
 */
// TODO: Make into abstract class Buffer, implemented by FrameBuffer and ROIBuffer
export class FrameBuffer {
  private buffer: Map<number, Frame> = new Map(); // Frame data mapped by timestep index

  constructor(private roi: ROI, private maxFrames: number, private minFrames: number = 0) {
    if (minFrames > maxFrames) {
      throw new Error('minFrames cannot be greater than maxFrames.');
    }
  }

  /**
   * Adds a frame to the buffer.
   * @param frame - The frame to add.
   * @param timestepIndex - The timestep index of the frame.
   */
  add(frame: Frame, timestepIndex: number): void {
    // TODO: Implement preprocess(frame: Frame) in subclasses
    // - in FrameBuffer: crop and resize
    // - in ROIBuffer: crop and reduceRoi to RGB
    this.buffer.set(
      timestepIndex,
      this.preprocess(frame)
    );

    // Maintain the maximum buffer size
    while (this.buffer.size > this.maxFrames) {
      const oldestKey = Math.min(...this.buffer.keys());
      this.buffer.delete(oldestKey);
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
    const allFrames = keys.map((key) => this.buffer.get(key)!);
    this.buffer = new Map(retainKeys.map((key) => [key, this.buffer.get(key)!]));
    return allFrames;
  }

  /**
   * Clears the buffer.
   */
  clear(): void {
    this.buffer.clear();
  }
}
