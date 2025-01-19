import { MethodHandler } from './MethodHandler';
import { VitalLensOptions, VitalLensResult } from '../types/core';
import { Frame } from '../processing/Frame';
import { Tensor2D } from '@tensorflow/tfjs';

/**
 * Base class for simple rPPG methods (e.g., POS, CHROM, G).
 */
export abstract class SimpleMethodHandler extends MethodHandler {

  constructor(options: VitalLensOptions) {
    super(options);
  }

  /**
   * Processes a chunk of rgb signals to compute vitals.
   * @param rgb - Frame of rgb signals to process.
   * @returns A promise that resolves to the processed result.
   */
  async process(rgb: Frame): Promise<VitalLensResult> {
    rgb.retain();
    const ppg = this.algorithm(rgb.data as Tensor2D);
    const roi = rgb.roi;
    rgb.release();
    return {
      vitals: {
        ppgWaveform: ppg
      },
      time: rgb.timestamp,
      face: roi,
      state: {}, // No recurrent state for handcrafted methods
    };
  }
  
  /**
   * Abstract method for subclasses to implement their specific algorithm.
   * @param rgb - Tensor2D with rgb signals to process.
   */
  protected abstract algorithm(rgb: Tensor2D): number[];
}
