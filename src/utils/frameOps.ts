import * as tf from '@tensorflow/tfjs-core';
import { Frame } from '../processing/Frame';
import { ROI } from '../types/core';

/**
 * Merges an array of Frame objects into a single Frame asynchronously.
 * 
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

export function uint8ArrayToBase64(uint8Array: Uint8Array): string {
  let binary = "";
  const chunkSize = 65536; // Process in 64 KB chunks
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
