import * as tf from '@tensorflow/tfjs';
import { Frame } from '../processing/Frame';
import {
  detrend,
  detrendLambdaForHRResponse,
  standardize,
} from '../utils/arrayOps';
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
    return tf.tidy(() => {
      // Create a 2D tensor from the Frame's Float32Array data.
      const floatArray = rgb.getFloat32Array();
      const shape = rgb.getShape(); // Expected shape: [n, 3]
      const rgbTensor = tf.tensor2d(floatArray, shape as [number, number]);

      // --- RGB Normalization ---
      // Compute the mean for each row (keepdims = true -> shape: [n, 1]).
      const rowMean = tf.mean(rgbTensor, 1, true);
      // Normalize: (rgbTensor / rowMean) - 1.
      const rgb_n = tf.sub(tf.div(rgbTensor, rowMean), tf.scalar(1));

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
   * @returns The filtered pulse signal.
   */
  postprocess(
    signalType: 'ppg' | 'resp',
    data: number[],
    fps: number
  ): number[] {
    const lambda = detrendLambdaForHRResponse(fps);
    let processed = detrend(data, lambda);
    processed = standardize(processed);
    return processed;
  }
}
