import { ROI } from '../types/core';
import { Frame } from './Frame';
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
   * @returns The processed frame.
   */
  protected async preprocess(frame: Frame, roi: ROI): Promise<Frame> {
    frame.retain(); // 4 (or 5 if in use by face detector)

    try {
      // Assert that the frame data is a 3D tensor
      if (!frame.data || frame.data.rank !== 3 || frame.data.shape.length != 3) {
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
          [roi.height, roi.width, frame.data.shape[2] || 1] // Size [height, width, depth]
        );
      });

      // Resize the cropped tensor if inputSize is specified
      const resized = this.methodConfig.inputSize
        ? tf.tidy(() => {
            return tf.image.resizeBilinear(cropped as tf.Tensor3D, [this.methodConfig.inputSize!, this.methodConfig.inputSize!]);
          })
        : cropped;

      // Dispose of the cropped tensor if resizing was performed
      if (resized !== cropped) {
        cropped.dispose();
      }

      // Return the processed frame with the original timestamp
      return new Frame(resized as tf.Tensor3D, frame.timestamp);
    } finally {
      frame.release(); // 3 (or 4 if in use by face detector)
    }
  }
}
