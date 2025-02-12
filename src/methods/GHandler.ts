import { Frame } from '../processing/Frame';
import { SimpleMethodHandler } from './SimpleMethodHandler';
import tf from 'tfjs-provider';
import {
  standardize,
  movingAverage,
  movingAverageSizeForHRResponse,
  adaptiveDetrend,
} from '../../src/utils/arrayOps';
import { CALC_HR_MIN } from '../config/constants';

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
   * @returns The estimated signal as number[].
   */
  protected algorithm(rgb: Frame): number[] {
    // Select the G channel
    const result = tf.tidy(() => {
      const data = tf.reshape(tf.slice(rgb.getTensor(), [0, 1], [-1, 1]), [-1]);
      // Convert the tensor to a 1D array of numbers
      return data.arraySync() as number[];
    });

    return result;
  }

  /**
   * Postprocess the estimated signal.
   * Applies detrending and standardization.
   * @param signalType The type of signal ('ppg' or 'resp').
   * @param data The raw estimated signal.
   * @param fps The sampling frequency.
   * @param light Whether to do only light processing.
   * @returns The filtered pulse signal.
   */
  postprocess(
    signalType: 'ppg' | 'resp',
    data: number[],
    fps: number,
    light: boolean
  ): number[] {
    let processed = light ? data : adaptiveDetrend(data, fps, CALC_HR_MIN / 60);
    // Determine the moving average window size.
    const windowSize = movingAverageSizeForHRResponse(fps);
    // Apply the moving average filter.
    processed = movingAverage(data, windowSize);
    // Standardize the filtered signal.
    if (!light) processed = standardize(processed);
    return processed;
  }
}
