import tf from 'tfjs-provider';
import { Frame } from '../processing/Frame';
import { ROI } from '../types/core';

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
