import * as tf from '@tensorflow/tfjs';
import { ROI } from '../types';

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
    const rawData = tensor.dataSync().buffer;
    const expectedSize = tensor.shape.reduce((a, b) => a * b);
    
    var actualSize;
    switch (tensor.dtype) {
      case 'uint8':
        actualSize = new Uint8Array(rawData).length;
        break;
      case 'int32':
        actualSize = new Int32Array(rawData).length;
        break;
      case 'float32':
        actualSize = new Float32Array(rawData).length;
        break;
      default:
        throw new Error(`Unsupported dtype: ${tensor.dtype}`);
    }
    if (expectedSize !== actualSize) {
      console.warn(`Mismatch in tensor size: expected ${expectedSize}, but got ${actualSize}`);
    }

    return new Frame(rawData, tensor.shape, tensor.dtype, timestamp, roi);
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
  
    if (actualSize === expectedSize) {
      return tf.tensor(typedArray, this.shape, this.dtype);
    }
  
    if (actualSize < expectedSize) {
      throw new Error(`Mismatch in raw data size: expected ${expectedSize}, but got ${actualSize}. Shape: ${this.shape}, DType: ${this.dtype}`);
    }
  
    const offset = actualSize - expectedSize;
    console.warn(
      `Mismatch in raw data size: expected ${expectedSize}, but got ${actualSize}. Shape: ${this.shape}, DType: ${this.dtype}. Ignoring first ${offset} elements.`
    );
  
    // TODO: Make sure frame data is correct
    return tf.tensor(typedArray.slice(offset), this.shape, this.dtype);
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

  /**
   * Converts the raw data of the frame to a Base64-encoded string.
   * If the raw data is already a Uint8Array, it directly encodes it; otherwise,
   * it creates a Uint8Array from the raw buffer.
   */
  getBase64Data(): string {
    // Ensure the raw data is in Uint8Array form
    const uint8Array = this.rawData instanceof Uint8Array
      ? this.rawData
      : new Uint8Array(this.rawData);
    
      // Calculate the expected size based on the shape
    const expectedSize = this.shape.reduce((a, b) => a * b);
    
    // Check for offsets or mismatched sizes
    let offset = 0;
    if (uint8Array.length > expectedSize) {
      console.warn(`Mismatch in raw data size: expected ${expectedSize}, but got ${uint8Array.length}. Ignoring first ${uint8Array.length - expectedSize} elements.`);
      offset = uint8Array.length - expectedSize;
    } else if (uint8Array.length < expectedSize) {
      throw new Error(`Mismatch in raw data size: expected ${expectedSize}, but got ${uint8Array.length}`);
    }

    // Adjust for any offset and slice to the expected size
    const adjustedArray = uint8Array.slice(offset);

    // Convert to Base64
    return btoa(String.fromCharCode(...adjustedArray));
  }
}
