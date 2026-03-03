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
});
