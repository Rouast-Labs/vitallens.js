import * as tf from '@tensorflow/tfjs';
import { POSHandler } from '../../src/methods/POSHandler';
import { Frame } from '../../src/processing/Frame';
import { VitalLensOptions } from '../../src/types';

describe('POSHandler', () => {
  let posHandler: POSHandler;
  const options: VitalLensOptions = { method: 'pos' };

  beforeEach(() => {
    posHandler = new POSHandler(options);
  });

  describe('getMethodName', () => {
    it('should return "POS"', () => {
      expect(posHandler['getMethodName']()).toBe('POS');
    });
  });

  describe('algorithm', () => {
    it('should compute POS signal correctly for known input', () => {
      const rgbData = tf.tensor2d(
        [
          [1, 2, 3],
          [2, 4, 6],
        ],
        [2, 3]
      );
      const frame = Frame.fromTensor(rgbData);
      const result = posHandler['algorithm'](frame);
      expect(result.length).toBe(2);
      result.forEach((val) => {
        expect(val).toBeCloseTo(0, 5);
      });
      rgbData.dispose();
    });

    it('should handle an empty tensor gracefully', () => {
      const emptyTensor = tf.tensor2d([], [0, 3]);
      const frame = Frame.fromTensor(emptyTensor);
      const result = posHandler['algorithm'](frame);
      expect(result).toEqual([]);
    });
  });

  describe('postprocess', () => {
    it('should detrend and standardize the signal', () => {
      // Create a simple linearly increasing signal.
      const rawSignal = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const fps = 30;
      const processed = posHandler.postprocess('ppg', rawSignal, fps);
      // Check same length.
      expect(processed.length).toBe(rawSignal.length);

      // Compute mean and std.
      const mean = processed.reduce((sum, v) => sum + v, 0) / processed.length;
      const stdDev = Math.sqrt(
        processed.reduce((sum, v) => sum + (v - mean) ** 2, 0) /
          processed.length
      );
      // Expect near zero mean and near unit standard deviation.
      expect(mean).toBeCloseTo(0, 2);
      expect(stdDev).toBeCloseTo(1, 2);
    });
  });
});
