import tf from 'tfjs-provider';
import { Frame } from './Frame';
import { Buffer } from './Buffer';
import { ROI } from '../types';

/**
 * Resizes an image to size x size. Above 2x downscaling, averages boxes of source
 * pixels: bilinear to the next integer multiple of size, then average pooling.
 * @param image - The image tensor of shape [h, w, c].
 * @param size - The output height and width.
 * @returns The resized image tensor.
 */
export function downsample(image: tf.Tensor3D, size: number): tf.Tensor3D {
  const [h, w] = image.shape;
  if (h / size <= 2 || w / size <= 2) {
    return tf.image.resizeBilinear(image, [size, size]);
  }
  const kh = Math.ceil(h / size);
  const kw = Math.ceil(w / size);
  const upsampled = tf.image.resizeBilinear(image, [size * kh, size * kw]);
  return tf.avgPool(upsampled, [kh, kw], [kh, kw], 'valid');
}

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
      const resized = this.methodConfig.inputSize
        ? downsample(cropped as tf.Tensor3D, this.methodConfig.inputSize)
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
