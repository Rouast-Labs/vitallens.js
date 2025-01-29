import { Frame } from '../../src/processing/Frame';
import { GHandler } from '../../src/methods/GHandler';
import * as tf from '@tensorflow/tfjs';
import { VitalLensOptions } from '../../src/types';

describe('GHandler', () => {
  let gHandler: GHandler;
  const options: VitalLensOptions = { method: 'g' };

  beforeEach(() => {
    gHandler = new GHandler(options);
  });

  test('getMethodName should return "G"', () => {
    expect(gHandler['getMethodName']()).toBe('G');
  });

  test('algorithm should extract the G channel correctly', () => {
    // Mock RGB tensor for testing
    const rgbData = tf.tensor2d(
      [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
        [0.7, 0.8, 0.9],
      ],
      [3, 3]
    );
    const frame = Frame.fromTensor(rgbData);

    // Run the G algorithm
    const result = gHandler['algorithm'](frame);

    // Expected G channel values
    const expected = [0.2, 0.5, 0.8];

    result.forEach((value, index) => {
      expect(value).toBeCloseTo(expected[index], 6);
    });
  });

  test('algorithm should handle empty tensors gracefully', () => {
    // Mock empty tensor for testing
    const emptyTensor = tf.tensor2d([], [0, 3]);
    const frame = Frame.fromTensor(emptyTensor);

    // Run the G algorithm
    const result = gHandler['algorithm'](frame);

    // Expected output should be an empty array
    expect(result).toEqual([]);
  });
});
