import { MethodConfig } from '../config/methodsConfig';
import { ROI } from '../types/core';
import { Frame } from './Frame';
import { Buffer } from './Buffer';
import * as tf from '@tensorflow/tfjs';

/**
 * A buffer implementation for managing RGB frames with specific preprocessing.
 */
export class RGBBuffer extends Buffer {
  /**
   * Preprocesses a frame by cropping and converting ROI to RGB.
   * @param frame - The frame to preprocess.
   * @param roi - The region of interest for cropping.
   * @param methodConfig - Configuration for the method, including input size.
   * @returns The processed frame.
   */
  protected async preprocess(frame: Frame, roi: ROI, methodConfig: MethodConfig): Promise<Frame> {
    frame.retain(); // 4 (or 5 if in use by face detector)
    
    try {
      // Assert that the frame data is a 3D tensor
      if (!frame.data || frame.data.rank !== 3) {
        throw new Error(`Frame data must be a 3D tensor. Received rank: ${frame.data?.rank}`);
      }

      // Validate ROI dimensions
      if (
        roi.x < 0 ||
        roi.y < 0 ||
        roi.x + roi.width > frame.data.shape[1] ||
        roi.y + roi.height > frame.data.shape[0]
      ) {
        throw new Error(
          `ROI dimensions are out of bounds. Frame dimensions: [${frame.data.shape[0]}, ${frame.data.shape[1]}], ROI: ${JSON.stringify(roi)}`
        );
      }

      // Crop the tensor based on the ROI
      const cropped = tf.tidy(() => {
        return frame.data.slice(
          [roi.y, roi.x, 0], // Start point [y, x, channel]
          [roi.height, roi.width, 3] // Size [height, width, depth]
        );
      });

      // Compute the spatial average across the ROI
      const averaged = tf.tidy(() => {
        return cropped.mean([0, 1]); // Mean across height and width dimensions, preserving channel dimension
      });

      // Dispose of the cropped tensor after averaging
      cropped.dispose();

      // Return the processed frame with the original timestamp
      return new Frame(averaged, frame.timestamp);
    } finally {
      frame.release(); // 3 (or 4 if in use by face detector)
    }
  }
}
