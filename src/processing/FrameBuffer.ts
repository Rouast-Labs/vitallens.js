import tf from 'tfjs-provider';
import { Frame } from './Frame';
import { Buffer } from './Buffer';
import { ROI } from '../types';

/**
 * A buffer implementation for managing frames with specific preprocessing.
 */
export class FrameBuffer extends Buffer {
  /**
   * Preprocesses a frame by cropping and resizing it.
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
    if (
      shape.length !== 3 ||
      shape[0] <= 0 ||
      shape[1] <= 0 ||
      shape[2] !== 3
    ) {
      throw new Error(
        `Frame data must be a 3D tensor. Received rank: ${shape.length}`
      );
    }

    const roi = overrideRoi ?? this.roi;

    // Validate ROI dimensions
    if (
      !roi ||
      roi.x0 < 0 ||
      roi.y0 < 0 ||
      roi.x1 > shape[1] ||
      roi.y1 > shape[0] ||
      roi.x1 - roi.x0 <= 0 ||
      roi.y1 - roi.y0 <= 0
    ) {
      throw new Error(
        `ROI dimensions are out of bounds. Frame dimensions: [${shape[0]}, ${shape[1]}], ROI: ${JSON.stringify(roi)}`
      );
    }

    // Perform all operations in one tf.tidy block
    const processedFrame = tf.tidy(() => {
      // Get the tensor
      const tensor = frame.getTensor();
      // Crop the tensor based on the ROI
      const cropped = tf.slice(
        tensor,
        [roi.y0, roi.x0, 0], // Start point [y, x, channel]
        [roi.y1 - roi.y0, roi.x1 - roi.x0, shape[2] || 1] // Size [height, width, depth]
      );

      // Resize the cropped tensor if inputSize is specified
      // TODO: resizeBilinear has no antialiasing - at large downscale factors (e.g. ~300px -> 40px)
      //   it samples ~4 source px per output px, discarding the spatial averaging that lifts the
      //   pulse above sensor noise, and mismatching training (ffmpeg bicubic) / Python (box) / iOS
      //   (vImage). Use area/box averaging instead, e.g. bilinear to an integer multiple of
      //   inputSize then tf.avgPool, or a shared box-downsample in vitallens-core (WASM).
      //   Verify first: same recording via Python vs JS, compare confidence/SNR.
      const resized = this.methodConfig.inputSize
        ? tf.image.resizeBilinear(cropped as tf.Tensor3D, [
            this.methodConfig.inputSize!,
            this.methodConfig.inputSize!,
          ])
        : cropped;

      // Create the new Frame from the processed tensor
      return resized;
    });

    const result = Frame.fromTensor(
      processedFrame,
      keepTensor,
      frame.getTimestamp(),
      [roi]
    );

    if (keepTensor) {
      // Keep processed frame tensor - need to release() appropriately!
      result.retain();
    } else {
      processedFrame.dispose();
    }

    return result;
  }
}
