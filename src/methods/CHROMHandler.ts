import { Frame } from '../types';
import { SimpleMethodHandler } from './SimpleMethodHandler';

/**
 * Handler for processing frames using the CHROM algorithm.
 */
export class CHROMHandler extends SimpleMethodHandler {
  protected computeVitals(rgb: Frame): Record<string, any> {

    // Implement CHROM-specific logic to estimate vitals
    const hr = this.estimateHeartRate(rgb);

    return {
      heartRate: hr,
    };
  }

  private estimateHeartRate(rgb: Frame): number {
    // TODO
    return Math.random() * 40 + 60; // Random HR between 60-100 bpm
  }
}
