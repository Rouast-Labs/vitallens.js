import { MethodConfig } from '../config/methodsConfig';
import { Frame, ROI } from '../types/core';
import { Buffer } from './Buffer';
import * as tf from '@tensorflow/tfjs';

/**
 * A buffer implementation for managing frames with specific preprocessing.
 */
export class FrameBuffer extends Buffer {
  /**
   * Preprocesses a frame by cropping and resizing it.
   * @param frame - The frame to preprocess.
   * @param roi - The region of interest for cropping.
   * @param methodConfig - Configuration for the method, including input size.
   * @returns The processed frame.
   */
  protected async preprocess(frame: Frame, roi: ROI, methodConfig: MethodConfig): Promise<Frame> {
    // Assert that the frame data is a tensor
    if (!frame.data || frame.data.rank < 2 || frame.data.rank > 4) {
      throw new Error(`Frame data must be a 2D, 3D, or 4D tensor. Received rank: ${frame.data?.rank}`);
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
        [roi.height, roi.width, frame.data.shape[2] || 1] // Size [height, width, depth]
      );
    });

    // Resize the cropped tensor if inputSize is specified
    const resized = methodConfig.inputSize
      ? tf.tidy(() => {
          return tf.image.resizeBilinear(cropped, [methodConfig.inputSize!, methodConfig.inputSize!]);
        })
      : cropped;

    // If resizing was skipped, ensure cropped is returned, otherwise dispose cropped
    if (resized !== cropped) {
      cropped.dispose();
    }

    // Return the processed frame with the original timestamp
    return { data: resized, timestamp: frame.timestamp };
  }
}
