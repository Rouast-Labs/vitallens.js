import { MethodHandler } from './MethodHandler';
import {
  InferenceMode,
  VitalLensOptions,
  VitalLensResult,
} from '../types/core';
import { Frame } from '../processing/Frame';

/**
 * Base class for simple rPPG methods (e.g., POS, CHROM, G).
 */
export abstract class SimpleMethodHandler extends MethodHandler {
  constructor(options: VitalLensOptions) {
    super(options);
  }

  /**
   * Initialise the method.
   */
  async init(): Promise<void> {
    // Nothing needs to be initialized for simple methods.
  }

  /**
   * Cleanup the method.
   */
  async cleanup(): Promise<void> {
    // Nothing needs to be initialized for simple methods.
  }

  /**
   * Get readiness state.
   * @returns Whether the method is ready for prediction.
   */
  getReady(): boolean {
    // Always ready
    return true;
  }

  /**
   * Processes a chunk of rgb signals to compute vitals.
   * @param rgb - Frame of rgb signals to process.
   * @param mode - The inference mode.
   * @returns A promise that resolves to the processed result.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async process(rgb: Frame, mode: InferenceMode): Promise<VitalLensResult> {
    const ppg = this.algorithm(rgb);
    return {
      face: {
        coordinates: rgb
          .getROI()
          .map((roi) => [roi.x0, roi.y0, roi.x1, roi.y1]),
        confidence: new Array(ppg.length).fill(1.0),
        note: 'Face detection coordinates for this face, along with live confidence levels. This method is not capable of providing a confidence estimate, hence returning 1.',
      },
      vital_signs: {
        ppg_waveform: {
          data: ppg,
          unit: 'bpm',
          confidence: new Array(ppg.length).fill(1.0),
          note: `Estimate of the ppg waveform using ${this.getMethodName()}. This method is not capable of providing a confidence estimate, hence returning 1.`,
        },
      },
      time: rgb.getTimestamp(),
      message:
        'The provided values are estimates and should be interpreted according to the provided confidence levels ranging from 0 to 1. The VitalLens API is not a medical device and its estimates are not intended for any medical purposes.',
    };
  }

  /**
   * Abstract method for subclasses to implement their specific algorithm.
   * @param rgb - Tensor2D with rgb signals to process.
   */
  protected abstract algorithm(rgb: Frame): number[];
}
