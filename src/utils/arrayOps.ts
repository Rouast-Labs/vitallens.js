import * as tf from '@tensorflow/tfjs-core';
import { Frame } from '../processing/Frame';
import { ROI } from '../types/core';

/**
 * Merges an array of Frame objects into a single Frame asynchronously.
 * @param frames - An array of Frame objects to merge.
 * @returns A Promise resolving to a single Frame with concatenated data and concatenated timestamps.
 */
export async function mergeFrames(frames: Frame[]): Promise<Frame> {
  if (frames.length === 0) {
    throw new Error('Cannot merge an empty array of frames.');
  }

  // Merge data using tf.tidy to manage memory
  const concatenatedTensor = await tf.tidy(() => {
    const tensors = frames.map((frame) => frame.getTensor());
    return tf.stack(tensors); // Stack along a new dimension
  });

  // Concatenate all timestamps
  const concatenatedTimestamps = frames.flatMap((frame) => frame.getTimestamp());

  // Concatenate all ROIs into a single array
  const concatenatedROIs: ROI[] = frames.flatMap((frame) => frame.getROI());

  // Convert the tensor back to raw data for the new Frame
  const mergedFrame = await Frame.fromTensor(concatenatedTensor, concatenatedTimestamps, concatenatedROIs);
  concatenatedTensor.dispose();

  return mergedFrame;
}

/**
 * Converts a Uint8Array into a base64 string.
 * @param uint8Array The array to be converted
 * @returns The resulting base64 string
 */
export function uint8ArrayToBase64(uint8Array: Uint8Array): string {
  let binary = "";
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
  let binaryString = "";
  for (let i = 0; i < uint8.length; i++) {
    binaryString += String.fromCharCode(uint8[i]);
  }
  return btoa(binaryString);
}

/**
 * Estimates the required moving average size to achieve a given response.
 * @param samplingFreq - The sampling frequency [Hz].
 * @param cutoffFreq - The desired cutoff frequency [Hz].
 * @returns The estimated moving average size.
 */
export function movingAverageSizeForResponse(samplingFreq: number, cutoffFreq: number): number {
  if (cutoffFreq <= 0) {
    throw new Error("Cutoff frequency must be greater than zero.");
  }
  // Adapted from https://dsp.stackexchange.com/a/14648
  const F = cutoffFreq / samplingFreq;
  const size = Math.floor(Math.sqrt(0.196202 + F * F) / F);
  return Math.max(size, 1);
}

/**
 * Applies a moving average filter to the input data.
 * @param data - The input waveform data.
 * @param windowSize - The size of the moving average window.
 * @returns The smoothed waveform data.
 */
export function applyMovingAverage(data: number[], windowSize: number): number[] {
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
