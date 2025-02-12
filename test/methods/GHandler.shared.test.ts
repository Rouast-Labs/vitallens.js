import * as tf from '@tensorflow/tfjs-core';
import { Frame } from '../../src/processing/Frame';
import { GHandler } from '../../src/methods/GHandler';
import { VitalLensOptions } from '../../src/types';

describe('GHandler', () => {
  let gHandler: GHandler;
  const options: VitalLensOptions = { method: 'g' };

  beforeEach(() => {
    gHandler = new GHandler(options);
  });

  describe('getMethodName', () => {
    it('should return "G"', () => {
      expect(gHandler['getMethodName']()).toBe('G');
    });
  });

  describe('algorithm', () => {
    it('should extract the G channel correctly', () => {
      // Create a sample RGB tensor with shape [3, 3]
      const rgbData = tf.tensor2d(
        [
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6],
          [0.7, 0.8, 0.9],
        ],
        [3, 3]
      );
      const frame = Frame.fromTensor(rgbData);
      // Run the algorithm to extract the G channel and invert it.
      const result = gHandler['algorithm'](frame);
      const expected = [0.2, 0.5, 0.8];
      expect(result.length).toBe(expected.length);
      result.forEach((value, index) => {
        expect(value).toBeCloseTo(expected[index], 6);
      });
      rgbData.dispose();
    });

    it('should handle empty tensors gracefully', () => {
      const emptyTensor = tf.tensor2d([], [0, 3]);
      const frame = Frame.fromTensor(emptyTensor);
      const result = gHandler['algorithm'](frame);
      expect(result).toEqual([]);
    });
  });

  describe('postprocess', () => {
    it('should detrend, smooth, and standardize the signal', () => {
      // Create a raw estimated signal (for example purposes)
      const rawSignal = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      // Choose a sample frames-per-second value.
      const fps = 30;
      const processed = gHandler.postprocess('ppg', rawSignal, fps, false);
      // Check that the processed signal has the same length as the raw signal.
      expect(processed.length).toBe(rawSignal.length);

      // Verify that the postprocessed signal is standardized:
      // Its mean should be near 0 and its standard deviation near 1.
      const mean = processed.reduce((acc, v) => acc + v, 0) / processed.length;
      const std = Math.sqrt(
        processed.reduce((acc, v) => acc + (v - mean) ** 2, 0) /
          processed.length
      );
      expect(mean).toBeCloseTo(0, 3);
      expect(std).toBeCloseTo(1, 3);
    });
  });
});
