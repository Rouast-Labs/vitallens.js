import { Frame, ROI } from '../types/core';
import { Buffer } from './Buffer';
import { MethodConfig, METHODS_CONFIG } from '../config/methodsConfig';
import { FrameBuffer } from './FrameBuffer';
import { RGBBuffer } from './RGBBuffer';

/**
 * Manages multiple FrameBuffers for handling different ROIs and method configurations.
 */
export class BufferManager {
  private buffers: Map<string, { buffer: Buffer; createdAt: number }>; // Map of buffer ID to buffer and creation timestamp
  private state: any = null; // Optional recurrent state
  
  constructor() {
    this.buffers = new Map();
  }

  /**
   * Generates a unique buffer ID based on ROI.
   * @param roi - The ROI associated with the buffer.
   * @returns A unique buffer ID string.
   */
  private generateBufferId(roi: ROI): string {
    return `${roi.x},${roi.y},${roi.width},${roi.height}`;
  }

  /**
   * Adds a new buffer for a given ROI and method configuration.
   * @param roi - The ROI for the new buffer.
   * @param method - The method for the buffer.
   * @param minFrames - Minimum number of frames required for processing.
   * @param maxFrames - Maximum number of frames the buffer can hold.
   * @param timestepIndex - The current timestep index.
   */
  addBuffer(roi: ROI, method: string, minFrames: number, maxFrames: number, timestepIndex: number): void {
    const id = this.generateBufferId(roi);
    if (!this.buffers.has(id)) {
      let newBuffer: Buffer;
      if (method === 'vitallens') {
        newBuffer = new FrameBuffer(roi, maxFrames, minFrames, METHODS_CONFIG[method]);
      } else {
        newBuffer = new RGBBuffer(roi, maxFrames, minFrames, METHODS_CONFIG[method]);
      }
      this.buffers.set(id, { buffer: newBuffer, createdAt: timestepIndex });
    }
  }

  /**
   * Checks if there is a managed buffer which is ready for processing.
   * @returns True if the buffer has enough frames, false otherwise.
   */
  isReady(): boolean {
    return this.getReadyBuffer() != null;
  }

  /**
   * Retrieves the most recent buffer that is ready for processing.
   * @returns The ready buffer or null if none are ready.
   */
  private getReadyBuffer(): Buffer | null {
    let readyBuffer: Buffer | null = null;
    let newestTimestep = 0;

    for (const { buffer, createdAt } of this.buffers.values()) {
      if (buffer.isReady() && createdAt > newestTimestep) {
        readyBuffer = buffer;
        newestTimestep = createdAt;
      }
    }

    // Cleanup old buffers
    this.cleanupBuffers(newestTimestep);

    return readyBuffer;
  }

  /**
   * Adds a frame to the active buffers.
   * @param frame - The frame to add.
   * @param timestepIndex - The timestep index of the frame.
   */
  add(frame: Frame, timestepIndex: number): void {
    for (const { buffer, createdAt } of this.buffers.values()) {
      buffer.add(frame, timestepIndex);
    }
  }

  /**
   * Consumes frames from the newest ready buffer.
   * @returns The consumed frames or an empty array if no buffer is ready.
   */
  consume(): Frame[] {
    const readyBuffer = this.getReadyBuffer();
    return readyBuffer ? readyBuffer.consume() : [];
  }

  /**
   * Cleans up buffers that are older than the given timestep index.
   * @param timestepIndex - The current timestep index.
   */
  private cleanupBuffers(timestepIndex: number): void {
    for (const [id, { buffer, createdAt }] of this.buffers.entries()) {
      if (createdAt < timestepIndex) {
        this.buffers.delete(id);
      }
    }
  }

  /**
   * Clears all buffers, resets the manager and state.
   */
  cleanup(): void {
    this.buffers.clear();
    this.state = null;
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
}
