import * as tf from '@tensorflow/tfjs-core';
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

  // Merge data using tf.tidy to manage memory
  const concatenatedTensor = tf.tidy(() => {
    const tensors = frames.map((frame) => frame.getTensor());
    return tf.stack(tensors); // Stack along a new dimension
  });

  // Concatenate all timestamps
  const concatenatedTimestamps = frames.flatMap((frame) => frame.getTimestamp());

  // Concatenate all ROIs into a single array
  const concatenatedROIs: ROI[] = frames.flatMap((frame) => frame.getROI());

  // Convert the tensor back to raw data for the new Frame
  const mergedFrame = Frame.fromTensor(concatenatedTensor, concatenatedTimestamps, concatenatedROIs);
  concatenatedTensor.dispose();

  return mergedFrame;
}
