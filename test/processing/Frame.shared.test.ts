/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import * as tf from '@tensorflow/tfjs';
import { Frame, getActualSizeFromRawData } from '../../src/processing/Frame';
import { ROI } from '../../src/types';

describe('Frame Class', () => {
  const mockROI: ROI[] = [
    { x0: 0, y0: 0, x1: 1, y1: 1 },
    { x0: 1, y0: 1, x1: 3, y1: 3 },
  ];

  describe('Constructor and Getters', () => {
    test('constructor initializes fields correctly with rawData', () => {
      const rawData = new ArrayBuffer(12);
      const shape = [2, 2, 3];
      const dtype = 'int32';
      const timestamp = [0.1, 0.2];
      const frame = new Frame({
        rawData,
        shape,
        dtype,
        timestamp,
        roi: mockROI,
        keepTensor: false,
      });

      expect(frame.getRawData()).toBe(rawData);
      expect(frame.getShape()).toEqual(shape);
      expect(frame.getDType()).toBe(dtype);
      expect(frame.getTimestamp()).toEqual(timestamp);
      expect(frame.getROI()).toEqual(mockROI);
      expect(frame.hasTensor()).toEqual(false);
    });

    test('constructor initializes fields correctly with tensor and keeps it', () => {
      const tensor = tf.tensor([1, 2, 3, 4, 5, 6], [2, 1, 3], 'float32');
      const frame = new Frame({ tensor, keepTensor: true });

      expect(frame.getTensor()).toBe(tensor);
      expect(frame.getShape()).toEqual([2, 1, 3]);
      expect(frame.getDType()).toBe('float32');
      expect(frame.hasTensor()).toBe(true);

      frame.disposeTensor();
    });

    test('constructor initializes fields correctly with tensor and does not keep it', () => {
      const tensor = tf.tensor([1, 2, 3, 4, 5, 6], [2, 1, 3], 'float32');
      const frame = new Frame({ tensor, keepTensor: false });
      const typedData = tensor.dataSync() as Float32Array;

      expect(frame.getRawData()).toStrictEqual(typedData.buffer);
      expect(frame.getShape()).toEqual([2, 1, 3]);
      expect(frame.getDType()).toBe('float32');
      expect(frame.hasTensor()).toBe(false);

      tensor.dispose();
    });
  });

  describe('fromTensor', () => {
    test('initializes with float32 tensor and keeps it when keepTensor is true', () => {
      const tensor = tf.tensor([1, 2, 3, 4, 5, 6], [2, 1, 3], 'float32');
      const frame = Frame.fromTensor(tensor, true, [0.1, 0.2], mockROI);

      expect(frame.getTensor()).toBe(tensor);
      expect(frame.getShape()).toEqual([2, 1, 3]);
      expect(frame.getDType()).toBe('float32');
      expect(frame.getTimestamp()).toEqual([0.1, 0.2]);
      expect(frame.getROI()).toEqual(mockROI);
      expect(frame.hasTensor()).toBe(true);

      frame.disposeTensor();
    });

    test('converts with float32 tensor to rawData when keepTensor is false', () => {
      const tensor = tf.tensor([1, 2, 3, 4, 5, 6], [2, 1, 3], 'int32');
      const frame = Frame.fromTensor(tensor, false);

      expect(frame.getRawData()).toBeDefined();
      expect(frame.getShape()).toEqual([2, 1, 3]);
      expect(frame.getDType()).toBe('int32');
      expect(frame.getTimestamp()).toEqual([]);
      expect(frame.getROI()).toEqual([]);
      expect(frame.hasTensor()).toBe(false);

      tensor.dispose();
    });

    test('initializes correctly for int32', () => {
      const dtype = 'int32';
      const tensor = tf.tensor([1, 2, 3, 4, 5, 6], [2, 1, 3], dtype);
      const timestamp = [0.1, 0.2];
      const frame = Frame.fromTensor(tensor, false, timestamp, mockROI);

      expect(frame.getRawData()).toBeDefined();
      expect(frame.getShape()).toEqual([2, 1, 3]);
      expect(frame.getDType()).toBe(dtype);
      expect(frame.getTimestamp()).toEqual(timestamp);
      expect(frame.getROI()).toEqual(mockROI);
      expect(frame.hasTensor()).toBe(false);

      tensor.dispose();
    });

    test('throws for unsupported dtypes', () => {
      const tensor = tf.tensor([1, 2, 3], [3], 'bool' as tf.DataType);

      expect(() => Frame.fromTensor(tensor)).toThrowError(
        /Unsupported dtype: bool/
      );
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
    test('returns correct tensor when keepTensor is true', () => {
      const tensor = tf.tensor([1, 2, 3], [3], 'int32');
      const frame = new Frame({ tensor, keepTensor: true });

      expect(frame.getTensor()).toBe(tensor);

      frame.disposeTensor();
    });

    test('reconstructs tensor from rawData when keepTensor is false', () => {
      const rawData = new Int32Array([1, 2, 3]).buffer;
      const frame = new Frame({
        rawData,
        shape: [3],
        dtype: 'int32',
        keepTensor: false,
      });

      const outTensor = frame.getTensor();
      expect(outTensor).toBeInstanceOf(tf.Tensor);
      expect(outTensor.shape).toEqual([3]);

      outTensor.dispose();
    });

    test('throws for insufficient raw data', () => {
      const rawData = new Uint8Array([1, 2, 3]).buffer; // Smaller than shape
      const frame = new Frame({
        rawData,
        shape: [2, 1, 3],
        dtype: 'uint8' as tf.DataType,
      });

      expect(() => frame.getTensor()).toThrowError(
        /Mismatch in tensor size: expected 6, but got 3/
      );
    });
  });

  describe('disposeTensor', () => {
    test('disposes of tensor when kept', () => {
      const tensor = tf.tensor([1, 2, 3], [3], 'int32');
      const frame = new Frame({ tensor, keepTensor: true });

      frame.disposeTensor();
      expect(() => frame.getTensor()).toThrow();
    });
  });

  describe('getUint8Array', () => {
    test('returns Uint8Array for uint8 dtype', () => {
      const rawData = new Uint8Array([1, 2, 3]).buffer;
      const frame = new Frame({
        rawData,
        shape: [3],
        dtype: 'uint8' as tf.DataType,
        keepTensor: false,
      });
      expect(Array.from(frame.getUint8Array())).toEqual([1, 2, 3]);
    });

    test('converts other dtypes to Uint8Array', () => {
      const rawData = new Float32Array([1.1, 2.2, 3.3]).buffer;
      const frame = new Frame({
        rawData,
        shape: [3],
        dtype: 'float32',
        keepTensor: false,
      });
      expect(Array.from(frame.getUint8Array())).toEqual([1, 2, 3]);
    });
  });

  // TODO: Test getInt32Array
  // TODO: Test getFloat32Array
  // TODO: Test retain and release

  describe('Miscellaneous', () => {
    test('getTypedArrayClass correctly maps dtypes', () => {
      const rawData = new ArrayBuffer(4);
      const uint8Frame = new Frame({
        rawData,
        shape: [1],
        dtype: 'uint8' as tf.DataType,
      });
      const float32Frame = new Frame({ rawData, shape: [1], dtype: 'float32' });
      const int32Frame = new Frame({ rawData, shape: [1], dtype: 'int32' });

      expect(uint8Frame['getTypedArrayClass']()).toBe(Uint8Array);
      expect(float32Frame['getTypedArrayClass']()).toBe(Float32Array);
      expect(int32Frame['getTypedArrayClass']()).toBe(Int32Array);
    });
  });
});

describe('getActualSizeFromRawData', () => {
  it('calculates size for uint8 data', () => {
    const buffer = new ArrayBuffer(8);
    const result = getActualSizeFromRawData(buffer, 'uint8' as tf.DataType);
    expect(result).toBe(8);
  });

  it('calculates size for int32 data', () => {
    const buffer = new ArrayBuffer(16);
    const result = getActualSizeFromRawData(buffer, 'int32');
    expect(result).toBe(4);
  });

  it('calculates size for float32 data', () => {
    const buffer = new ArrayBuffer(16);
    const result = getActualSizeFromRawData(buffer, 'float32');
    expect(result).toBe(4);
  });

  it('throws an error for unsupported dtype', () => {
    const buffer = new ArrayBuffer(8);
    expect(() => getActualSizeFromRawData(buffer, 'unknown' as any)).toThrow(
      'Unsupported dtype: unknown'
    );
  });
});
