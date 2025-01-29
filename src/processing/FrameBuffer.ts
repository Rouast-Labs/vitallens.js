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
   * @returns The processed frame.
   */
  protected async preprocess(frame: Frame): Promise<Frame> {
    // Assert that the frame data is a 3D tensor
    const shape = frame.getShape();
    if (shape.length !== 3) {
      throw new Error(`Frame data must be a 3D tensor. Received rank: ${shape.length}`);
    }
    
    // Validate ROI dimensions
    if (this.roi.x0 < 0 || this.roi.y0 < 0 || this.roi.x1 > shape[1] || this.roi.y1 > shape[0] ) {
      throw new Error(
        `ROI dimensions are out of bounds. Frame dimensions: [${shape[0]}, ${shape[1]}], ROI: ${JSON.stringify(this.roi)}`
      );
    }

    // Perform all operations in one tf.tidy block
    const processedFrame = tf.tidy(() => {
      // Get the tensor
      const tensor = frame.getTensor();
      // Crop the tensor based on the ROI
      const cropped = tensor.slice(
        [this.roi.y0, this.roi.x0, 0], // Start point [y, x, channel]
        [this.roi.y1 - this.roi.y0, this.roi.x1 - this.roi.x0, shape[2] || 1] // Size [height, width, depth]
      );

      // Resize the cropped tensor if inputSize is specified
      const resized = this.methodConfig.inputSize
        ? tf.image.resizeBilinear(cropped as tf.Tensor3D, [
            this.methodConfig.inputSize!,
            this.methodConfig.inputSize!,
          ])
        : cropped;

      // Create the new Frame from the processed tensor
      return resized;
    });

    // TODO: Investigate speedup and memory implications if keeping tensor here
    const result = Frame.fromTensor(processedFrame, false, frame.getTimestamp(), [this.roi])

    processedFrame.dispose();

    return result;
  }
}
