import { Frame } from '../processing/Frame';
import { SimpleMethodHandler } from './SimpleMethodHandler';
import * as tf from '@tensorflow/tfjs';
import {
  detrend,
  standardize,
  movingAverage,
  movingAverageSizeForHRResponse,
  detrendLambdaForHRResponse,
} from '../../src/utils/arrayOps';

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
      const data = rgb.getTensor().slice([0, 1], [-1, 1]).flatten();
      // Convert the tensor to a 1D array of numbers
      return data.arraySync() as number[];
    });

    return result;
  }

  /**
   * Postprocess the estimated signal.
   * @param signalType The type of signal ('ppg' or 'resp').
   * @param data The raw estimated signal.
   * @param fps The sampling frequency of the signal.
   * @returns The filtered and standardized signal.
   */
  postprocess(
    signalType: 'ppg' | 'resp',
    data: number[],
    fps: number
  ): number[] {
    // Determine lambda for detrending from fps.
    const lambda = detrendLambdaForHRResponse(fps);
    // Detrend the signal.
    let processed = detrend(data, lambda);

    // Determine the moving average window size.
    const windowSize = movingAverageSizeForHRResponse(fps);
    // Apply the moving average filter.
    processed = movingAverage(processed, windowSize);

    // Standardize the filtered signal.
    processed = standardize(processed);

    return processed;
  }
}
