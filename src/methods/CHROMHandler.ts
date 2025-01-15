import { Tensor2D } from '@tensorflow/tfjs';
import { SimpleMethodHandler } from './SimpleMethodHandler';

/**
 * Handler for processing frames using the CHROM algorithm.
 */
export class CHROMHandler extends SimpleMethodHandler {
  /**
   * Implementation of the CHROM algorithm.
   * @param rgb - Tensor2D with rgb signals to process.
   */
  protected algorithm(rgb: Tensor2D): number[] {
    // TODO: Implement algorithm
    return [];
  }
}
