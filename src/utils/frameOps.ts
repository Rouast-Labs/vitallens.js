import { Tensor, stack } from '@tensorflow/tfjs-core';
import { Frame } from '../processing/Frame';
import { ROI } from '../types/core';

/**
 * Merges an array of Frame objects into a single Frame.
 * 
 * @param frames - An array of Frame objects to merge.
 * @returns A single Frame with concatenated data and concatenated timestamps.
 */
export function mergeFrames(frames: Frame[]): Frame {
  if (frames.length === 0) {
    throw new Error('Cannot merge an empty array of frames.');
  }

  frames.forEach((frame) => frame.retain());

  try {
    // Extract the 1D or 3D tensors from each frame
    const tensors: Tensor[] = frames.map((frame) => frame.data);

    // Concatenate along a new dimension (sequence dimension)
    const concatenatedData = stack(tensors);

    // Concatenate all timestamps
    const concatenatedTimestamps = frames.flatMap((frame) => frame.timestamp);

    // Concatenate all ROIs into a single array
    const concatenatedROIs: ROI[] = frames.flatMap((frame) => frame.roi);

    // Return the merged frame
    return new Frame(concatenatedData, concatenatedTimestamps, concatenatedROIs);
  } finally {
    // Release the original frames after use
    frames.forEach((frame) => frame.release());
  }
}
