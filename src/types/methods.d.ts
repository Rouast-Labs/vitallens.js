/**
 * Type definitions for method handlers in the VitalLens library.
 */

import { Frame, VitalLensResult } from './core';

/**
 * Interface for a processing method.
 */
export interface MethodHandler {
  /**
   * Processes a buffer of frames and returns the computed result.
   * @param frames - Array of frames to process.
   * @param state - Optional recurrent state for the method.
   * @returns A promise that resolves to the processed result.
   */
  process(frames: Frame[], state?: any): Promise<VitalLensResult>;
}
