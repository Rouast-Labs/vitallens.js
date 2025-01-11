import { Frame } from '../types/core';

/**
 * A class to manage buffering of frames and handling recurrent state.
 */
export class FrameBuffer {
  private buffer: Frame[] = [];
  private state: any = null;

  constructor(private maxFrames: number, private minFrames: number = 0) {
    if (minFrames > maxFrames) {
      throw new Error('minFrames cannot be greater than maxFrames.');
    }
  }

  /**
   * Adds a frame to the buffer.
   * @param frame - The frame to add.
   */
  add(frame: Frame): void {
    this.buffer.push(frame);

    // Maintain the maximum buffer size
    if (this.buffer.length > this.maxFrames) {
      this.buffer.shift();
    }
  }

  /**
   * Consumes the buffered frames but retains the last `minFrames` in the buffer.
   * @returns The consumed frames (including the retained ones).
   */
  consume(): Frame[] {
    const framesToRetain = this.buffer.slice(-(this.minFrames-1)); // Retain the last `(minFrames-1)` frames
    const framesToReturn = [...this.buffer]; // Return all frames
    this.buffer = framesToRetain; // Retain only the last `minFrames`
    return framesToReturn;
  }

  /**
   * Checks if the buffer is ready for processing.
   * @returns True if the buffer has enough frames, false otherwise.
   */
  isReady(): boolean {
    return this.buffer.length >= this.minFrames;
  }

  /**
   * Sets the recurrent state.
   * @param state - The new state to set.
   */
  setState(state: any): void {
    this.state = state;
  }

  /**
   * Gets the current recurrent state.
   * @returns The current state.
   */
  getState(): any {
    return this.state;
  }

  /**
   * Clears the buffer and resets the state.
   */
  clear(): void {
    this.buffer = [];
    this.state = null;
  }
}
