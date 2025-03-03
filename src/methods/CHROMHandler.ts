import tf from 'tfjs-provider';
import { Frame } from '../processing/Frame';
import {
  adaptiveDetrend,
  movingAverage,
  movingAverageSizeForHRResponse,
  standardize,
} from '../utils/arrayOps';
import { SimpleMethodHandler } from './SimpleMethodHandler';
import { CALC_HR_MIN } from '../config/constants';

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
   * @returns The estimated pulse signal.
   */
  protected algorithm(rgb: Frame): number[] {
    return tf.tidy(() => {
      const rgbTensor = rgb.getTensor();

      // --- RGB Normalization ---
      // Compute the temporal mean; result shape: [1, 3]
      const temporalMean = tf.mean(rgbTensor, 0, true);
      // Normalize: (rgbTensor / temporalMean) - 1.
      const rgb_n = tf.sub(tf.div(rgbTensor, temporalMean), tf.scalar(1));

      // --- CHROM Computation ---
      // Extract channels as [n, 1] tensors.
      const R = tf.slice(rgb_n, [0, 0], [-1, 1]);
      const G = tf.slice(rgb_n, [0, 1], [-1, 1]);
      const B = tf.slice(rgb_n, [0, 2], [-1, 1]);

      // Compute Xs = 3 * R - 2 * G.
      const Xs = tf.sub(tf.mul(tf.scalar(3), R), tf.mul(tf.scalar(2), G));
      // Compute Ys = 1.5 * R + G - 1.5 * B.
      const Ys = tf.add(
        tf.add(tf.mul(tf.scalar(1.5), R), G),
        tf.mul(tf.scalar(-1.5), B)
      );

      // Compute standard deviations using tf.moments.
      const { variance: varXs } = tf.moments(Xs);
      const { variance: varYs } = tf.moments(Ys);
      const stdXs = tf.sqrt(varXs);
      const stdYs = tf.sqrt(varYs);

      // Convert standard deviations to numbers.
      const stdXNumber = Number(stdXs.dataSync()[0]);
      const stdYNumber = Number(stdYs.dataSync()[0]);

      // Compute alpha = std(Xs) / std(Ys).
      const alpha = stdXNumber / stdYNumber;

      // Compute the CHROM signal: chrom = Xs - alpha * Ys.
      const chromTensor = tf.sub(Xs, tf.mul(tf.scalar(alpha), Ys));

      // Return the CHROM signal as a flat JavaScript array.
      return Array.from(chromTensor.dataSync());
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
    processed = movingAverage(data, windowSize);
    // Standardize the filtered signal.
    if (!light) processed = standardize(processed);
    return processed;
  }
}
