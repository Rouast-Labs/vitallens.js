import * as tf from '@tensorflow/tfjs-core';
import { CHROMHandler } from '../../src/methods/CHROMHandler';
import { Frame } from '../../src/processing/Frame';
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
});
