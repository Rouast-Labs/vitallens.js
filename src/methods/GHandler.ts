import { Tensor2D } from '@tensorflow/tfjs';
import { SimpleMethodHandler } from './SimpleMethodHandler';
import * as tf from '@tensorflow/tfjs';

/**
 * Handler for processing frames using the G algorithm.
 */
export class GHandler extends SimpleMethodHandler {
  /**
   * Implementation of the G algorithm.
   * @param rgb - Tensor2D with rgb signals to process.
   */
  protected algorithm(rgb: Tensor2D): number[] {
    // Select the G channel
    const sliced = tf.tidy(() => {
      return rgb.slice([0, 1], [-1, 1]);
    });
    // Convert the tensor to a 1D array of numbers
    const result = sliced.arraySync() as number[][];
    sliced.dispose();
    // Flatten the array to number[]
    return result.flat();
  }
}
