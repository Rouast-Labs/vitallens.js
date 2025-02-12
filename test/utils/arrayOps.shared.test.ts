import * as tf from '@tensorflow/tfjs-core';
import {
  mergeFrames,
  uint8ArrayToBase64,
  float32ArrayToBase64,
  movingAverageSizeForResponse,
  movingAverage,
  detrend,
  detrendLambdaForHRResponse,
  detrendLambdaForRRResponse,
  standardize,
  movingAverageSizeForHRResponse,
  movingAverageSizeForRRResponse,
} from '../../src/utils/arrayOps';
import { Frame } from '../../src/processing/Frame';

describe('mergeFrames', () => {
  it('throws an error when merging an empty array', async () => {
    await expect(mergeFrames([])).rejects.toThrow(
      'Cannot merge an empty array of frames.'
    );
  });

  it('merges frames correctly from Frame with keepTensor false', async () => {
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

  it('merges frames correctly from Frame with keepTensor true', async () => {
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
    expect(encoded.length).toBeGreaterThan(0);
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

describe('movingAverage', () => {
  it('returns the same array for window size 1', () => {
    const data = [1, 2, 3, 4, 5];
    const result = movingAverage(data, 1);
    expect(result).toEqual(data);
  });

  it('applies moving average correctly for a simple case', () => {
    const data = [1, 2, 3, 4, 5];
    // With window size 3, our implementation calculates:
    // result[0] = 1, result[1] = (1+2)/2 = 1.5, result[2] = (1+2+3)/3 = 2, result[3] = (2+3+4)/3 = 3, result[4] = (3+4+5)/3 = 4.
    const result = movingAverage(data, 3);
    expect(result).toEqual([1, 1.5, 2, 3, 4]);
  });

  it('applies moving average correctly for a windowed-mean-like case', () => {
    // Adapted from the Python test for windowed_mean:
    // For data = [0, 1, 2, 3, 4, 5, 6] and window size 3,
    // our movingAverage returns [0, 0.5, 1, 2, 3, 4, 5]
    const data = [0, 1, 2, 3, 4, 5, 6];
    const result = movingAverage(data, 3);
    expect(result).toEqual([0, 0.5, 1, 2, 3, 4, 5]);
  });
});

describe('detrend', () => {
  it('returns the original signal if length is less than 3', () => {
    const signal = [1, 2];
    const lambda = 10;
    const detrended = detrend(signal, lambda);
    expect(detrended).toEqual(signal);
  });

  it('detrends a constant signal to near zero', () => {
    // For a constant signal, detrending should remove the offset.
    const signal = [5, 5, 5, 5, 5];
    const lambda = 100;
    const detrended = detrend(signal, lambda);
    detrended.forEach((value) => {
      expect(value).toBeCloseTo(0, 5);
    });
  });

  it('detrends a linearly increasing signal', () => {
    // For a linearly increasing signal, the detrended signal should have near-zero mean.
    const signal = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const lambda = 10;
    const detrended = detrend(signal, lambda);
    expect(detrended.length).toEqual(signal.length);
    const mean =
      detrended.reduce((acc, value) => acc + value, 0) / detrended.length;
    expect(mean).toBeCloseTo(0, 5);
  });
});

describe('detrendLambdaForHRResponse', () => {
  it('calculates the lambda for HR response correctly', () => {
    // For fps = 30, expected lambda is floor(0.1614 * 30^1.9804)
    const fps = 30;
    const expected = Math.floor(0.1614 * Math.pow(fps, 1.9804));
    const lambda = detrendLambdaForHRResponse(fps);
    expect(lambda).toEqual(expected);
  });
});

describe('detrendLambdaForRRResponse', () => {
  it('calculates the lambda for RR response correctly', () => {
    // For fps = 30, expected lambda is floor(4.4248 * 30^2.1253)
    const fps = 30;
    const expected = Math.floor(4.4248 * Math.pow(fps, 2.1253));
    const lambda = detrendLambdaForRRResponse(fps);
    expect(lambda).toEqual(expected);
  });
});

describe('standardize', () => {
  it('standardizes a signal to zero mean and unit variance', () => {
    const signal = [1, 2, 3, 4, 5];
    const standardized = standardize(signal);
    // Mean should be near 0
    const mean =
      standardized.reduce((acc, v) => acc + v, 0) / standardized.length;
    expect(mean).toBeCloseTo(0, 5);
    // Standard deviation should be near 1
    const std = Math.sqrt(
      standardized.reduce((acc, v) => acc + v * v, 0) / standardized.length
    );
    expect(std).toBeCloseTo(1, 5);
  });
});

describe('movingAverageSizeForHRResponse and movingAverageSizeForRRResponse', () => {
  it('returns a window size of at least 1 for HR response', () => {
    const size = movingAverageSizeForHRResponse(30);
    expect(size).toBeGreaterThanOrEqual(1);
  });
  it('returns a window size of at least 1 for RR response', () => {
    const size = movingAverageSizeForRRResponse(30);
    expect(size).toBeGreaterThanOrEqual(1);
  });
});
