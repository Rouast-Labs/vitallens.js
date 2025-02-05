import { CHROMHandler } from '../../src/methods/CHROMHandler';
import { Frame } from '../../src/processing/Frame';
import * as tf from '@tensorflow/tfjs';
import { VitalLensOptions } from '../../src/types';

describe('CHROMHandler', () => {
  let chromHandler: CHROMHandler;
  const options: VitalLensOptions = { method: 'chrom' };

  beforeEach(() => {
    chromHandler = new CHROMHandler(options);
  });

  describe('getMethodName', () => {
    it('should return "CHROM"', () => {
      expect(chromHandler['getMethodName']()).toBe('CHROM');
    });
  });

  describe('algorithm', () => {
    it('should compute CHROM signal correctly for known input', () => {
      const rgbTensor = tf.tensor2d(
        [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
        [3, 3]
      );
      const frame = Frame.fromTensor(rgbTensor);
      const result = chromHandler['algorithm'](frame);
      expect(result.length).toBe(3);
      result.forEach((val) => {
        expect(val).toBeCloseTo(0, 5);
      });
      rgbTensor.dispose();
    });
  });

  describe('postprocess', () => {
    it('should detrend and standardize the signal', () => {
      // Use a simple linearly increasing signal.
      const rawSignal = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const fps = 30;
      const processed = chromHandler.postprocess('ppg', rawSignal, fps);
      // Check that the processed signal has the same length as the input.
      expect(processed.length).toBe(rawSignal.length);

      // Compute mean and standard deviation.
      const mean = processed.reduce((sum, v) => sum + v, 0) / processed.length;
      const stdDev = Math.sqrt(
        processed.reduce((sum, v) => sum + (v - mean) ** 2, 0) /
          processed.length
      );
      expect(mean).toBeCloseTo(0, 2);
      expect(stdDev).toBeCloseTo(1, 2);
    });
  });
});
