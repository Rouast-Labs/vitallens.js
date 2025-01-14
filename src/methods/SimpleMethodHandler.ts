import { MethodHandler } from './MethodHandler';
import { Frame, VitalLensOptions, VitalLensResult } from '../types/core';

/**
 * Base class for simple rPPG methods (e.g., POS, CHROM, G).
 */
export abstract class SimpleMethodHandler extends MethodHandler {

  constructor(options: VitalLensOptions) {
    super(options);
    // TODO maxBufferSize?
  }

  /**
   * Processes a buffer of frames to compute vitals.
   * @param rgb - Array of frames to process.
   * @returns A promise that resolves to the processed result.
   */
  async process(rgb: Frame): Promise<VitalLensResult> {
    const vitals = this.computeVitals(rgb);
    return {
      vitals,
      state: {}, // No recurrent state for handcrafted methods
    };
  }
  
  /**
   * Abstract method for subclasses to implement their specific algorithm.
   * @param rgb - Array of frames to process.
   */
  protected abstract computeVitals(rgb: Frame): Record<string, any>;
}
