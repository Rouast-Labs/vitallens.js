import * as tf from '@tensorflow/tfjs';
import { ROI } from '../types';

/**
 * Determines the size (number of elements) from an ArrayBuffer of raw data.
 * @param rawData The raw data
 * @param dtype The data type
 * @returns The number of elements in the raw data
 */
function getActualSizeFromRawData(rawData: ArrayBuffer, dtype: tf.DataType): number {
  switch (dtype) {
    case 'uint8':
      return new Uint8Array(rawData).length;
    case 'int32':
      return new Int32Array(rawData).length;
    case 'float32':
      return new Float32Array(rawData).length;
    default:
      throw new Error(`Unsupported dtype: ${dtype}`);
  }
}

/**
 * Represents one or multiple frames in the video processing pipeline.
 */
export class Frame {
  private rawData: ArrayBuffer;
  private shape: number[];
  private dtype: tf.DataType;
  private timestamp: number[]; // In seconds
  private roi: ROI[];
  
  constructor(rawData: ArrayBuffer, shape: number[], dtype: tf.DataType, timestamp?: number[], roi?: ROI[]) {
    this.rawData = rawData;
    this.shape = shape;
    this.dtype = dtype;
    this.timestamp = timestamp ? timestamp : [];
    this.roi = roi ? roi : [];
  }

  /**
   * Creates a Frame from a TensorFlow.js Tensor.
   * @param tensor - The Tensor
   * @param timestamp - Optional timestamps for each frame.
   * @param roi - Optional regions of interest.
   */
  static fromTensor(tensor: tf.Tensor, timestamp?: number[], roi?: ROI[]): Frame {
    const typedData = tensor.dataSync() as Float32Array | Int32Array | Uint8Array;
    const expectedSize = tensor.shape.reduce((a, b) => a * b);
    const exactBuffer = typedData.buffer.slice(
      typedData.byteOffset,
      typedData.byteOffset + typedData.byteLength
    );
    
    const actualSize = getActualSizeFromRawData(exactBuffer, tensor.dtype);
    if (expectedSize !== actualSize) {
      throw new Error(`Mismatch in tensor size: expected ${expectedSize}, but got ${actualSize}`);
    }

    return new Frame(exactBuffer, tensor.shape, tensor.dtype, timestamp, roi);
  }

  /**
   * Creates a Frame directly from a Uint8Array.
   * @param video - The Uint8Array containing video data.
   * @param shape - The shape of the data (e.g., [nFrames, height, width, channels]).
   * @param timestamp - Optional timestamps for each frame.
   * @param roi - Optional regions of interest.
   * @returns An instance of Frame.
   */
  static fromUint8Array(
    array: Uint8Array,
    shape: number[],
    timestamp?: number[],
    roi?: ROI[]
  ): Frame {
    const rawData = array.buffer; // Use the underlying ArrayBuffer

    const expectedSize = shape.reduce((a, b) => a * b);
    const actualSize = getActualSizeFromRawData(rawData, 'uint8');
    if (expectedSize !== actualSize) {
      throw new Error(`Mismatch in raw data size: expected ${expectedSize}, but got ${actualSize}`);
    }
    
    return new Frame(rawData, shape, 'uint8' as tf.DataType, timestamp, roi);
  }

  /**
   * Converts the raw data back to a TensorFlow.js Tensor.
   */
  getTensor(): tf.Tensor {
    const TypedArrayClass = this.getTypedArrayClass();
    const typedArray = new TypedArrayClass(this.rawData);
  
    const expectedSize = this.shape.reduce((a, b) => a * b);
    const actualSize = typedArray.length;
  
    if (expectedSize !== actualSize) {
      throw new Error(`Mismatch in tensor size: expected ${expectedSize}, but got ${actualSize}`);
    }

    return tf.tensor(typedArray, this.shape, this.dtype);
  }

  /**
   * Determines the correct TypedArray class for the current dtype.
   */
  private getTypedArrayClass(): typeof Uint8Array | typeof Float32Array | typeof Int32Array {
    switch (this.dtype) {
      case 'uint8':
        return Uint8Array;
      case 'float32':
        return Float32Array;
      case 'int32':
        return Int32Array;
      default:
        throw new Error(`Unsupported dtype: ${this.dtype}`);
    }
  }

  /**
   * Returns the data as a Uint8Array
   * @returns The data as a Uint8Array
   */
  getUint8Array() {
    if (this.dtype === 'uint8') return new Uint8Array(this.rawData);

    const TypedArrayClass = this.getTypedArrayClass();
    const typedArray = new TypedArrayClass(this.rawData);
  
    return new Uint8Array(typedArray);
  }

  /**
   * Provides access to the raw data.
   */
  getRawData(): ArrayBuffer {
    return this.rawData;
  }

  /**
   * Provides the tensor shape.
   */
  getShape(): number[] {
    return this.shape;
  }

  /**
   * Provides the tensor dtype.
   */
  getDType(): tf.DataType {
    return this.dtype;
  }

  /**
   * Provides the tensor dtype.
   */
  getTimestamp(): number[] {
    return this.timestamp;
  }

  /**
   * Provides the tensor dtype.
   */
  getROI(): ROI[] {
    return this.roi;
  }
}
