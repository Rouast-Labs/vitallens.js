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
      // Use known test data:
      // We'll use three rows: [1, 2, 3], [4, 5, 6], [7, 8, 9].
      // For each row, the mean is computed and then the normalized value is (value/mean - 1).
      // For row1: mean = 2, normalized = [0.5-1, 1-1, 1.5-1] = [-0.5, 0, 0.5]
      // X1 = 3*(-0.5) - 2*(0) = -1.5; Y1 = 1.5*(-0.5) + 0 - 1.5*(0.5) = -0.75 - 0.75 = -1.5.
      // Similarly for row2: [4,5,6] -> mean=5, normalized = [-0.2, 0, 0.2] giving X2 = -0.6, Y2 = -0.6.
      // For row3: [7,8,9] -> mean=8, normalized = [-0.125, 0, 0.125] giving X3 = -0.375, Y3 = -0.375.
      // Then std(Xs) = std(Ys) so alpha = 1 and chrom = Xs - Ys = [0,0,0].

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
