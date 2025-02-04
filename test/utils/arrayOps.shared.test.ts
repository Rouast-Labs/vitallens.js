import * as tf from '@tensorflow/tfjs-core';
import {
  mergeFrames,
  uint8ArrayToBase64,
  float32ArrayToBase64,
  movingAverageSizeForResponse,
  applyMovingAverage,
} from '../../src/utils/arrayOps';
import { Frame } from '../../src/processing/Frame';

describe('mergeFrames', () => {
  it('throws an error when merging an empty array', async () => {
    await expect(mergeFrames([])).rejects.toThrow(
      'Cannot merge an empty array of frames.'
    );
  });

  it('merges frames correctly from Frame with keepTensor', async () => {
    const frame1 = await Frame.fromTensor(
      tf.tensor([1, 2]),
      false,
      [1],
      [{ x0: 0, y0: 0, x1: 2, y1: 2 }]
    );
    const frame2 = await Frame.fromTensor(
      tf.tensor([3, 4]),
      false,
      [2],
      [{ x0: 1, y0: 1, x1: 3, y1: 3 }]
    );

    const result = await mergeFrames([frame1, frame2]);

    expect(result.getTimestamp()).toEqual([1, 2]);
    expect(result.getROI()).toEqual([
      { x0: 0, y0: 0, x1: 2, y1: 2 },
      { x0: 1, y0: 1, x1: 3, y1: 3 },
    ]);

    const resultTensor = result.getTensor();
    expect(resultTensor.arraySync()).toEqual([
      [1, 2],
      [3, 4],
    ]);
    resultTensor.dispose();
  });

  it('merges frames correctly from Frame with keepTensor', async () => {
    const frame1 = await Frame.fromTensor(
      tf.tensor([1, 2]),
      true,
      [1],
      [{ x0: 0, y0: 0, x1: 2, y1: 2 }]
    );
    const frame2 = await Frame.fromTensor(
      tf.tensor([3, 4]),
      true,
      [2],
      [{ x0: 1, y0: 1, x1: 3, y1: 3 }]
    );

    const result = await mergeFrames([frame1, frame2]);

    expect(result.getTimestamp()).toEqual([1, 2]);
    expect(result.getROI()).toEqual([
      { x0: 0, y0: 0, x1: 2, y1: 2 },
      { x0: 1, y0: 1, x1: 3, y1: 3 },
    ]);

    const resultTensor = result.getTensor();
    expect(resultTensor.arraySync()).toEqual([
      [1, 2],
      [3, 4],
    ]);
    resultTensor.dispose();
    frame1.disposeTensor();
    frame2.disposeTensor();
  });
});

describe('uint8ArrayToBase64', () => {
  it('encodes a Uint8Array to Base64 correctly', () => {
    const input = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const base64 = uint8ArrayToBase64(input);
    expect(base64).toBe('SGVsbG8=');
  });
});

describe('float32ArrayToBase64', () => {
  it('encodes and decodes a Float32Array correctly', () => {
    const input = new Float32Array([1.23, -4.56, 7.89, 0]);
    const encoded = float32ArrayToBase64(input);
    expect(encoded.length).toBe(24);
  });
});

describe('movingAverageSizeForResponse', () => {
  it('calculates the correct moving average size', () => {
    const result = movingAverageSizeForResponse(30, 4);
    expect(result).toEqual(3);
  });

  it('throws an error for invalid cutoff frequency', () => {
    expect(() => movingAverageSizeForResponse(100, 0)).toThrow(
      'Cutoff frequency must be greater than zero.'
    );
  });
});

describe('applyMovingAverage', () => {
  it('returns the same array for window size 1', () => {
    const data = [1, 2, 3, 4, 5];
    const result = applyMovingAverage(data, 1);
    expect(result).toEqual(data);
  });

  it('applies moving average correctly', () => {
    const data = [1, 2, 3, 4, 5];
    const result = applyMovingAverage(data, 3);
    expect(result).toEqual([1, 1.5, 2, 3, 4]);
  });
});
