import { Frame } from './Frame';
import { Buffer } from './Buffer';
import * as tf from '@tensorflow/tfjs';
import { ROI } from '../types';

/**
 * A buffer implementation for managing RGB frames with specific preprocessing.
 */
export class RGBBuffer extends Buffer {
  /**
   * Preprocesses a frame by cropping and converting ROI to RGB.
   * @param frame - The frame to preprocess.
   * @param keepTensor - Whether to keep the tensor in the resulting frame.
   * @param overrideRoi - Use this ROI instead of buffer ROI (optional).
   * @returns The processed frame.
   */
  protected async preprocess(
    frame: Frame,
    keepTensor: boolean = false,
    overrideRoi?: ROI
  ): Promise<Frame> {
    // Assert that the frame data is a 3D tensor
    const shape = frame.getShape();
    if (shape.length !== 3) {
      throw new Error(
        `Frame data must be a 3D tensor. Received rank: ${shape.length}`
      );
    }

    const roi = overrideRoi ?? this.roi;

    // Validate ROI dimensions
    if (roi.x0 < 0 || roi.y0 < 0 || roi.x1 > shape[1] || roi.y1 > shape[0]) {
      throw new Error(
        `ROI dimensions are out of bounds. Frame dimensions: [${shape[0]}, ${shape[1]}], ROI: ${JSON.stringify(roi)}`
      );
    }

    // Perform all operations in one tf.tidy block
    const averagedFrame = tf.tidy(() => {
      // Get the tensor
      const tensor = frame.getTensor();
      // Crop the tensor based on the ROI
      const cropped = tensor.slice(
        [roi.y0, roi.x0, 0], // Start point [y, x, channel]
        [roi.y1 - roi.y0, roi.x1 - roi.x0, shape[2] || 1] // Size [height, width, depth]
      );

      // Compute the spatial average across the ROI
      const averaged = cropped.mean([0, 1]);

      return averaged;
    });

    const result = Frame.fromTensor(
      averagedFrame,
      keepTensor,
      frame.getTimestamp(),
      [roi]
    );

    if (keepTensor) {
      // Keep processed frame tensor - need to release() appropriately!
      result.retain();
    } else {
      averagedFrame.dispose();
    }

    return result;
  }
}
