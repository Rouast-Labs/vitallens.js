import { Tensor2D } from '@tensorflow/tfjs';
import { SimpleMethodHandler } from './SimpleMethodHandler';

/**
 * Handler for processing frames using the G algorithm.
 */
export class GHandler extends SimpleMethodHandler {
  /**
   * Implementation of the G algorithm.
   * @param rgb - Tensor2D with rgb signals to process.
   */
  protected algorithm(rgb: Tensor2D): number[] {
    // TODO: Implement algorithm
    return [];
  }
}
