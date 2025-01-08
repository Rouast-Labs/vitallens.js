/**
 * Utility functions for frame manipulation and processing.
 */

import { Frame } from '../types/core';

export class FrameUtils {
  /**
   * Converts a Base64 string to a Buffer (Node.js).
   * @param base64 - The Base64 string to convert.
   * @returns The Buffer representation of the Base64 string.
   */
  static base64ToBuffer(base64: string): Buffer {
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(base64Data, 'base64');
  }

  /**
   * Converts a Buffer to a Base64 string (Browser compatibility).
   * @param buffer - The Buffer to convert.
   * @returns The Base64 string representation of the Buffer.
   */
  static bufferToBase64(buffer: Buffer): string {
    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
  }

  /**
   * Normalizes frame timestamps for a sequence of frames.
   * Ensures timestamps are relative to the first frame in the sequence.
   * @param frames - Array of frames with timestamps.
   * @returns The array of frames with normalized timestamps.
   */
  static normalizeTimestamps(frames: Frame[]): Frame[] {
    if (frames.length === 0) return frames;

    const initialTimestamp = frames[0].timestamp;
    return frames.map((frame) => ({
      ...frame,
      timestamp: frame.timestamp - initialTimestamp,
    }));
  }

  /**
   * Downsamples a sequence of frames to a target frame rate.
   * @param frames - Array of frames to downsample.
   * @param targetFps - The target frame rate in frames per second.
   * @returns The downsampled array of frames.
   */
  static downsampleFrames(frames: Frame[], targetFps: number): Frame[] {
    const interval = 1000 / targetFps; // Interval in milliseconds
    const result: Frame[] = [];

    let lastTimestamp = -Infinity;
    for (const frame of frames) {
      if (frame.timestamp - lastTimestamp >= interval) {
        result.push(frame);
        lastTimestamp = frame.timestamp;
      }
    }

    return result;
  }

  /**
   * Merges multiple frame buffers into a single array of frames.
   * @param buffers - An array of frame buffers to merge.
   * @returns The merged array of frames.
   */
  static mergeBuffers(buffers: Frame[][]): Frame[] {
    return buffers.flat();
  }
}
