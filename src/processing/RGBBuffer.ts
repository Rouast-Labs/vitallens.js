import { Frame, ROI } from '../types/core';
import { Buffer } from './Buffer';

/**
 * A buffer implementation for managing RGB frames with specific preprocessing.
 */
export class RGBBuffer extends Buffer {
  /**
   * Preprocesses a frame by cropping and converting ROI to RGB.
   * @param frame - The frame to preprocess.
   * @returns The processed frame.
   */
  protected async preprocess(frame: Frame, roi: ROI): Promise<Frame> {
    // TODO: Implement cropping and converting ROI to RGB logic here
    // Placeholder for actual preprocessing logic
    return frame; // Replace with actual processed frame
  }
}
