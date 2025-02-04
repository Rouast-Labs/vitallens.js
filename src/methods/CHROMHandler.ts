import { Frame } from '../processing/Frame';
import { SimpleMethodHandler } from './SimpleMethodHandler';

/**
 * Handler for processing frames using the CHROM algorithm.
 */
export class CHROMHandler extends SimpleMethodHandler {
  /**
   * Get the method name. Subclasses must implement this.
   * @returns The method name.
   */
  protected getMethodName(): string {
    return 'CHROM';
  }
  /**
   * Implementation of the CHROM algorithm.
   * @param rgb - Tensor2D with rgb signals to process.
   */
  protected algorithm(rgb: Frame): number[] {
    // TODO: Implement algorithm
    console.log(rgb);
    return [];
  }
}
