import * as tf from '@tensorflow/tfjs';
import { Frame } from '../../src/processing/Frame';
import { ROI } from '../../src/types';

describe('Frame Class', () => {
  const mockROI: ROI[] = [
    { x: 0, y: 0, width: 1, height: 1 },
    { x: 1, y: 1, width: 2, height: 2 },
  ];

  describe('Constructor and Getters', () => {
    test('constructor initializes fields correctly', () => {
      const rawData = new ArrayBuffer(12);
      const shape = [2, 2, 3];
      const dtype = 'int32';
      const timestamp = [0.1, 0.2];
      const frame = new Frame(rawData, shape, dtype, timestamp, mockROI);

      expect(frame.getRawData()).toBe(rawData);
      expect(frame.getShape()).toEqual(shape);
      expect(frame.getDType()).toBe(dtype);
      expect(frame.getTimestamp()).toEqual(timestamp);
      expect(frame.getROI()).toEqual(mockROI);
    });
  });

  describe('fromTensor', () => {
    test('initializes correctly for int32', () => {
      const dtype = 'int32';
      const tensor = tf.tensor([1, 2, 3, 4, 5, 6], [2, 1, 3], dtype);
      const timestamp = [0.1, 0.2];
      const frame = Frame.fromTensor(tensor, timestamp, mockROI);

      expect(frame.getShape()).toEqual([2, 1, 3]);
      expect(frame.getDType()).toBe(dtype);
      expect(frame.getTimestamp()).toEqual(timestamp);
      expect(frame.getROI()).toEqual(mockROI);
    });

    test('initializes correctly for float32', () => {
      const dtype = 'float32';
      const tensor = tf.tensor([1, 2, 3, 4, 5, 6], [2, 1, 3], dtype);
      const timestamp = [0.1, 0.2];
      const frame = Frame.fromTensor(tensor, timestamp, mockROI);

      expect(frame.getShape()).toEqual([2, 1, 3]);
      expect(frame.getDType()).toBe(dtype);
      expect(frame.getTimestamp()).toEqual(timestamp);
      expect(frame.getROI()).toEqual(mockROI);
    });

    test('throws for unsupported dtypes', () => {
      const tensor = tf.tensor([1, 2, 3], [3], 'bool' as tf.DataType);

      expect(() => Frame.fromTensor(tensor)).toThrowError(/Unsupported dtype: bool/);
    });
  });

  describe('fromUint8Array', () => {
    test('initializes correctly', () => {
      const shape = [2, 1, 3];
      const timestamp = [1, 2, 3, 4, 5, 6];
      const array = new Uint8Array([1, 2, 3, 4, 5, 6]);
      const frame = Frame.fromUint8Array(array, shape, timestamp, mockROI);

      expect(frame.getShape()).toEqual(shape);
      expect(frame.getDType()).toBe('uint8');
      expect(frame.getTimestamp()).toEqual(timestamp);
      expect(frame.getROI()).toEqual(mockROI);
    });

    test('throws for mismatched raw data size', () => {
      const shape = [2, 1, 4]; // Expects 8 elements
      const array = new Uint8Array([1, 2, 3, 4, 5, 6]); // Only 6 elements

      expect(() => Frame.fromUint8Array(array, shape)).toThrowError(
        /Mismatch in raw data size/
      );
    });
  });

  describe('getTensor', () => {
    test('returns correct tensor for int32', () => {
      const rawData = new Int32Array([1, 2, 3, 4, 5, 6]).buffer;
      const frame = new Frame(rawData, [2, 1, 3], 'int32');

      const tensor = frame.getTensor();
      expect(tensor.shape).toEqual([2, 1, 3]);
      expect(tensor.dtype).toBe('int32');
      expect(Array.from(tensor.dataSync())).toEqual([1, 2, 3, 4, 5, 6]);
      tensor.dispose();
    });

    test('throws for insufficient raw data', () => {
      const rawData = new Uint8Array([1, 2, 3]).buffer; // Smaller than shape
      const frame = new Frame(rawData, [2, 1, 3], 'uint8' as tf.DataType);

      expect(() => frame.getTensor()).toThrowError(
        /Mismatch in tensor size: expected 6, but got 3/
      );
    });
  });

  describe('getUint8Array', () => {
    test('returns Uint8Array for uint8 dtype', () => {
      const rawData = new Uint8Array([1, 2, 3]).buffer;
      const frame = new Frame(rawData, [1, 3], 'uint8');

      const array = frame.getUint8Array();
      expect(Array.from(array)).toEqual([1, 2, 3]);
    });

    test('converts other dtypes to Uint8Array', () => {
      const rawData = new Float32Array([1.1, 2.2, 3.3]).buffer;
      const frame = new Frame(rawData, [1, 3], 'float32');

      const array = frame.getUint8Array();
      expect(Array.from(array)).toEqual([1, 2, 3]); // Floats truncated to ints
    });
  });

  describe('Miscellaneous', () => {
    test('getTypedArrayClass correctly maps dtypes', () => {
      const rawData = new ArrayBuffer(4);
      const uint8Frame = new Frame(rawData, [1], 'uint8' as tf.DataType);
      const float32Frame = new Frame(rawData, [1], 'float32');
      const int32Frame = new Frame(rawData, [1], 'int32');

      expect(uint8Frame['getTypedArrayClass']()).toBe(Uint8Array);
      expect(float32Frame['getTypedArrayClass']()).toBe(Float32Array);
      expect(int32Frame['getTypedArrayClass']()).toBe(Int32Array);
    });
  });
});
