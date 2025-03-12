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
   * @param rgb - A Frame whose data represents an RGB signal with shape [n, 3].
   * @returns The estimated POS signal as a 1D array.
   */
  protected algorithm(rgb: Frame): number[] {
    return tf.tidy(() => {
      const rgbTensor = rgb.getTensor();

      // --- Temporal Normalization ---
      // Compute the temporal mean; result shape: [1, 3]
      const temporalMean = tf.mean(rgbTensor, 0, true);
      // Compute c_n = rgbTensor / temporalMean
      const c_n = tf.div(rgbTensor, temporalMean);

      // --- Projection ---
      // Define projection matrix P = np.asarray([[0, 1, -1], [-2, 1, 1]]).T
      const P = tf.tensor2d([
        [0, -2],
        [1, 1],
        [-1, 1],
      ]); // shape [3, 2]
      const s = tf.matMul(c_n, P); // shape: [n, 2]

      // --- Tuning ---
      // Extract the two channels (each as shape [n])
      const s0 = tf.reshape(tf.slice(s, [0, 0], [-1, 1]), [-1]);
      const s1 = tf.reshape(tf.slice(s, [0, 1], [-1, 1]), [-1]);

      // Compute standard deviations.
      // Use tf.moments to get variance then tf.sqrt.
      const sigma1 = tf.sqrt(tf.moments(s0, 0).variance);
      const sigma2 = tf.sqrt(tf.moments(s1, 0).variance);
      // Convert to numbers.
      const sigma1Num = Number(sigma1.dataSync()[0]);
      const sigma2Num = Number(sigma2.dataSync()[0]);
      // Compute ratio = sigma1 / sigma2 (if sigma2 == 0, use 0)
      const ratio = sigma2Num === 0 ? 0 : sigma1Num / sigma2Num;
      // Compute h = s0 + ratio * s1.
      const h = tf.add(s0, tf.mul(tf.scalar(ratio), s1));

      // --- Inversion ---
      const pos = tf.mul(tf.scalar(-1), h);

      // Return the result as a JavaScript array.
      return Array.from(pos.dataSync());
    });
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
    processed = movingAverage(processed, windowSize);
    // Standardize the filtered signal.
    if (!light) processed = standardize(processed);
    return processed;
  }
}
