import { Frame } from '../processing/Frame';
import { SimpleMethodHandler } from './SimpleMethodHandler';

/**
 * Handler for processing frames using the POS algorithm.
 */
export class POSHandler extends SimpleMethodHandler {
  /**
   * Get the method name. Subclasses must implement this.
   * @returns The method name.
   */
  protected getMethodName(): string {
    return 'POS';
  }
  /**
   * Implementation of the POS algorithm.
   * @param rgb - Tensor2D with rgb signals to process.
   */
  protected algorithm(rgb: Frame): number[] {
    // TODO: Implement algorithm
    console.log(rgb);
    return [];
  }
}
