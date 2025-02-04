import { Frame } from '../processing/Frame';
import { SimpleMethodHandler } from './SimpleMethodHandler';
import * as tf from '@tensorflow/tfjs';

/**
 * Handler for processing frames using the G algorithm.
 */
export class GHandler extends SimpleMethodHandler {
  /**
   * Get the method name. Subclasses must implement this.
   * @returns The method name.
   */
  protected getMethodName(): string {
    return 'G';
  }
  /**
   * Implementation of the G algorithm.
   * @param rgb - Tensor2D with rgb signals to process.
   */
  protected algorithm(rgb: Frame): number[] {
    // Select the G channel
    const result = tf.tidy(() => {
      const data = rgb.getTensor().slice([0, 1], [-1, 1]).flatten();
      // Convert the tensor to a 1D array of numbers
      return data.arraySync() as number[];
    });

    return result;
  }
}
