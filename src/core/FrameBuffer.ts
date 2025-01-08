import { Frame } from '../types/core';

/**
 * A class to manage buffering of frames and handling recurrent state.
 */
export class FrameBuffer {
  private buffer: Frame[] = [];
  private state: any = null;

  constructor(private maxFrames: number) {}

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
   * Consumes the buffered frames and clears the buffer.
   * @returns The buffered frames.
   */
  consume(): Frame[] {
    const frames = [...this.buffer];
    this.buffer = [];
    return frames;
  }

  /**
   * Checks if the buffer is ready for processing.
   * @returns True if the buffer is full, false otherwise.
   */
  isReady(): boolean {
    return this.buffer.length >= this.maxFrames;
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
