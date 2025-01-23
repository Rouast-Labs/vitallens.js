import * as tf from '@tensorflow/tfjs';
import { Frame } from '../../src/processing/Frame';
import { ROI } from '../../src/types';

describe('Frame Class', () => {
  const mockROI: ROI[] = [
    { x: 0, y: 0, width: 1, height: 1 },
    { x: 1, y: 1, width: 2, height: 2 },
  ];

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

  test('fromTensor initializes correctly for int32', () => {
    const dtype = 'int32';
    const tensor = tf.tensor([1, 2, 3, 4, 5, 6], [2, 1, 3], dtype);
    const timestamp = [0.1, 0.2];
    const frame = Frame.fromTensor(tensor, timestamp, mockROI);

    expect(frame.getShape()).toEqual([2, 1, 3]);
    expect(frame.getDType()).toBe(dtype);
    expect(frame.getTimestamp()).toEqual(timestamp);
    expect(frame.getROI()).toEqual(mockROI);
  });

  test('fromTensor initializes correctly for float32', () => {
    const dtype = 'float32';
    const tensor = tf.tensor([1, 2, 3, 4, 5, 6], [6, 1], dtype);
    const timestamp = [0.1, 0.2];
    const frame = Frame.fromTensor(tensor, timestamp, mockROI);

    expect(frame.getShape()).toEqual([6, 1]);
    expect(frame.getDType()).toBe(dtype);
    expect(frame.getTimestamp()).toEqual(timestamp);
    expect(frame.getROI()).toEqual(mockROI);
  });

  test('fromUint8Array initializes correctly', () => {
    const shape = [2, 1, 3];
    const timestamp = [1, 2, 3, 4, 5, 6];
    const array = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const frame = Frame.fromUint8Array(array, shape, timestamp, mockROI);

    expect(frame.getShape()).toEqual(shape);
    expect(frame.getDType()).toBe('uint8');
    expect(frame.getTimestamp()).toEqual(timestamp);
    expect(frame.getROI()).toEqual(mockROI);
  });

  test('fromTensor works correctly for a larger float32 tensor', () => {
    // Create a tensor of shape [10, 10] = 100 elements
    const data = new Float32Array(100).map((_, i) => i + 0.5);
    const tensor = tf.tensor(data, [10, 10], 'float32');

    const frame = Frame.fromTensor(tensor);
    expect(frame.getShape()).toEqual([10, 10]);
    expect(frame.getDType()).toBe('float32');

    const reconstructedTensor = frame.getTensor();
    expect(reconstructedTensor.shape).toEqual([10, 10]);
    expect(reconstructedTensor.dtype).toBe('float32');
    // Compare the data
    expect(Array.from(reconstructedTensor.dataSync())).toEqual(Array.from(data));

    reconstructedTensor.dispose();
  });

  test('fromTensor works correctly for a larger int32 tensor', () => {
    // Create a tensor of shape [10, 10] = 100 elements
    const data = new Int32Array(100).map((_, i) => i + 1);
    const tensor = tf.tensor(data, [10, 10], 'int32');

    const frame = Frame.fromTensor(tensor);
    expect(frame.getShape()).toEqual([10, 10]);
    expect(frame.getDType()).toBe('int32');

    const reconstructedTensor = frame.getTensor();
    expect(reconstructedTensor.shape).toEqual([10, 10]);
    expect(reconstructedTensor.dtype).toBe('int32');
    // Compare the data
    expect(Array.from(reconstructedTensor.dataSync())).toEqual(Array.from(data));

    reconstructedTensor.dispose();
  });

  test('getTensor returns correct tensor for int32', () => {
    const rawData = new Int32Array([1, 2, 3, 4, 5, 6]).buffer;
    const frame = new Frame(rawData, [2, 1, 3], 'int32');

    const tensor = frame.getTensor();
    expect(tensor.shape).toEqual([2, 1, 3]);
    expect(tensor.dtype).toBe('int32');
    expect(Array.from(tensor.dataSync())).toEqual([1, 2, 3, 4, 5, 6]);
    tensor.dispose();
  });

  test('getTensor returns correct tensor for float32', () => {
    const rawData = new Float32Array([1.0, 2.0, 3.0, 4.0, 5.0, 6.0]).buffer;
    const frame = new Frame(rawData, [2, 1, 3], 'float32');

    const tensor = frame.getTensor();
    expect(tensor.shape).toEqual([2, 1, 3]);
    expect(tensor.dtype).toBe('float32');
    expect(Array.from(tensor.dataSync())).toEqual([1.0, 2.0, 3.0, 4.0, 5.0, 6.0]);
    tensor.dispose();
  });

  test('getTensor throws error for insufficient raw data', () => {
    const rawData = new Uint8Array([1, 2, 3]).buffer; // Smaller than shape
    // shape: [2, 1, 3] => expects 6 elements
    const frame = new Frame(rawData, [2, 1, 3], 'uint8' as tf.DataType);

    expect(() => frame.getTensor()).toThrowError(
      /Mismatch in tensor size: expected 6, but got 3/
    );
  });

  test('getTypedArrayClass correctly maps dtypes', () => {
    const rawData = new ArrayBuffer(4);
    const uint8Frame = new Frame(rawData, [1], 'uint8' as tf.DataType);
    const float32Frame = new Frame(rawData, [1], 'float32');
    const int32Frame = new Frame(rawData, [1], 'int32');

    expect(uint8Frame['getTypedArrayClass']()).toBe(Uint8Array);
    expect(float32Frame['getTypedArrayClass']()).toBe(Float32Array);
    expect(int32Frame['getTypedArrayClass']()).toBe(Int32Array);
  });

  test('fromTensor throws for unsupported dtypes', () => {
    const tensor = tf.tensor([1, 2, 3], [3], 'bool' as tf.DataType); // Invalid dtype

    expect(() => Frame.fromTensor(tensor)).toThrowError(/Unsupported dtype: bool/);
  });
});
