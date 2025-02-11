import * as tf from '@tensorflow/tfjs';
import { identity, multiply, add, subtract, transpose, inv } from 'mathjs';
import { Frame } from '../processing/Frame';
import { ROI } from '../types/core';
import { CALC_HR_MAX, CALC_RR_MAX } from '../config/constants';

/**
 * Merges an array of Frame objects into a single Frame asynchronously.
 * @param frames - An array of Frame objects to merge.
 * @param keepTensor - Whether to keep the tensor in the resulting frame.
 * @returns A Promise resolving to a single Frame with concatenated data and concatenated timestamps.
 */
export async function mergeFrames(
  frames: Frame[],
  keepTensor: boolean = false
): Promise<Frame> {
  if (frames.length === 0) {
    throw new Error('Cannot merge an empty array of frames.');
  }

  // Merge data using tf.tidy to manage memory
  const concatenatedTensor = await tf.tidy(() => {
    const tensors = frames.map((frame) => frame.getTensor());
    return tf.stack(tensors); // Stack along a new dimension
  });

  // Concatenate all timestamps
  const concatenatedTimestamps = frames.flatMap((frame) =>
    frame.getTimestamp()
  );

  // Concatenate all ROIs into a single array
  const concatenatedROIs: ROI[] = frames.flatMap((frame) => frame.getROI());

  // Wrap in a Frame
  const mergedFrame = await Frame.fromTensor(
    concatenatedTensor,
    keepTensor,
    concatenatedTimestamps,
    concatenatedROIs
  );

  if (keepTensor) {
    mergedFrame.retain();
  } else {
    concatenatedTensor.dispose();
  }

  return mergedFrame;
}

/**
 * Converts a Uint8Array into a base64 string.
 * @param uint8Array The array to be converted
 * @returns The resulting base64 string
 */
export function uint8ArrayToBase64(uint8Array: Uint8Array): string {
  let binary = '';
  const chunkSize = 65536; // Process in 64 KB chunks
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/**
 * Converts a Float32Array into a base64 string.
 * @param arr The array to be converted
 * @returns The resulting base64 string
 */
export function float32ArrayToBase64(arr: Float32Array): string {
  const uint8 = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  let binaryString = '';
  for (let i = 0; i < uint8.length; i++) {
    binaryString += String.fromCharCode(uint8[i]);
  }
  return btoa(binaryString);
}

/**
 * Applies a moving average filter to the input data.
 * @param data - The input waveform data.
 * @param windowSize - The size of the moving average window.
 * @returns The smoothed waveform data.
 */
export function movingAverage(data: number[], windowSize: number): number[] {
  if (windowSize <= 1) {
    return data;
  }

  const result = new Array(data.length).fill(0);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    if (i >= windowSize) {
      sum -= data[i - windowSize];
    }
    result[i] = sum / Math.min(i + 1, windowSize);
  }
  return result;
}

/**
 * Estimates the required moving average size to achieve a given response.
 * @param samplingFreq - The sampling frequency [Hz].
 * @param cutoffFreq - The desired cutoff frequency [Hz].
 * @returns The estimated moving average size.
 */
export function movingAverageSizeForResponse(
  samplingFreq: number,
  cutoffFreq: number
): number {
  if (cutoffFreq <= 0) {
    throw new Error('Cutoff frequency must be greater than zero.');
  }
  // Adapted from https://dsp.stackexchange.com/a/14648
  const F = cutoffFreq / samplingFreq;
  const size = Math.floor(Math.sqrt(0.196202 + F * F) / F);
  return Math.max(size, 1);
}

/**
 * Returns the moving average window size for heart rate response based on fps.
 * @param fps Frames per second.
 * @returns The window size.
 */
export function movingAverageSizeForHRResponse(fps: number): number {
  return movingAverageSizeForResponse(fps, CALC_HR_MAX / 60);
}

/**
 * Returns the moving average window size for respiratory rate response based on fps.
 * @param fps Frames per second.
 * @returns The window size.
 */
export function movingAverageSizeForRRResponse(fps: number): number {
  return movingAverageSizeForResponse(fps, CALC_RR_MAX / 60);
}

/**
 * Detrends a 1D signal using the method of Tarvainen et al. (2002)
 * with matrix inversion and related operations performed via math.js.
 *
 * The detrending operator is given by:
 *
 *    detrendOp = I - (I + λ²·D₂ᵀ·D₂)⁻¹
 *
 * where D₂ is the second-difference matrix defined such that:
 *    D₂[i, i] = 1,  D₂[i, i+1] = -2,  D₂[i, i+2] = 1.
 *
 * @param signal - The input signal as an array of numbers.
 * @param lambda - The regularization parameter.
 * @returns The detrended signal as an array of numbers.
 */
export function detrend(signal: number[], lambda: number): number[] {
  const T = signal.length;
  if (T < 3) {
    // Not enough data points for detrending; return the original signal.
    return signal;
  }

  // Create the identity matrix I of size T x T.
  // Note: identity(T, T) returns a math.js Matrix; we convert it to a 2D array.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const I = (identity(T, T) as any).toArray() as number[][];

  // Build the second-difference matrix D2 of shape (T-2) x T.
  // Each row i is defined as:
  //   D2[i, i]   = 1,
  //   D2[i, i+1] = -2,
  //   D2[i, i+2] = 1.
  const D2: number[][] = [];
  for (let i = 0; i < T - 2; i++) {
    const row = new Array(T).fill(0);
    row[i] = 1;
    row[i + 1] = -2;
    row[i + 2] = 1;
    D2.push(row);
  }

  // Compute the product D2ᵀ * D2.
  const D2T = transpose(D2) as number[][]; // Transpose of D2.
  const D2tD2 = multiply(D2T, D2) as unknown as number[][]; // Matrix multiplication.

  // Compute the regularization term: lambda² * (D2ᵀ * D2)
  const lambdaSq = lambda * lambda;
  const regularization = multiply(lambdaSq, D2tD2) as number[][];

  // Compute the matrix to invert: M = I + lambda² * (D2ᵀ * D2)
  const M = add(I, regularization) as number[][];

  // Invert M using math.js.
  const invM = inv(M) as number[][];

  // Compute the detrending operator: detrendOp = I - inv(M)
  const detrendOp = subtract(I, invM) as number[][];

  // Convert the input signal to a column vector (T x 1).
  const z = signal.map((x) => [x]);

  // Compute the detrended signal: y = (I - invM) * z.
  const y = multiply(detrendOp, z) as unknown as number[][];

  // Flatten the result (a T x 1 column vector) to a 1D array.
  const result = y.map((row) => row[0]);
  return result;
}

/**
 * Returns the detrending lambda for heart rate response based on fps.
 * @param fps Frames per second.
 * @returns A lambda value.
 */
export function detrendLambdaForHRResponse(fps: number): number {
  return Math.floor(0.1614 * Math.pow(fps, 1.9804));
}

/**
 * Returns the detrending lambda for respiratory rate response based on fps.
 * @param fps Frames per second.
 * @returns A lambda value.
 */
export function detrendLambdaForRRResponse(fps: number): number {
  return Math.floor(4.4248 * Math.pow(fps, 2.1253));
}

/**
 * Standardizes an array of numbers (zero mean, unit variance).
 * @param signal The input signal.
 * @returns The standardized signal.
 */
export function standardize(signal: number[]): number[] {
  const mean = signal.reduce((sum, v) => sum + v, 0) / signal.length;
  const std = Math.sqrt(
    signal.reduce((sum, v) => sum + (v - mean) ** 2, 0) / signal.length
  );
  return signal.map((v) => (v - mean) / (std || 1));
}
