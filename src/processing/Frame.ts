import * as tf from '@tensorflow/tfjs';
import { ROI } from '../types';

export interface FrameOptions {
  rawData?: ArrayBuffer;
  tensor?: tf.Tensor;
  shape?: number[];
  dtype?: tf.DataType;
  keepTensor?: boolean;
  timestamp?: number[]; // In seconds
  roi?: ROI[];
}

/**
 * Determines the size (number of elements) from an ArrayBuffer of raw data.
 * @param rawData The raw data
 * @param dtype The data type
 * @returns The number of elements in the raw data
 */
export function getActualSizeFromRawData(rawData: ArrayBuffer, dtype: tf.DataType): number {
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
  private rawData?: ArrayBuffer;
  private tensor?: tf.Tensor;

  private shape: number[];
  private dtype: tf.DataType;
  
  private timestamp: number[]; // In seconds
  private roi: ROI[];

  private refCount: number = 0;

  constructor(options: FrameOptions) {
    const {
      rawData,
      tensor,
      shape,
      dtype,
      keepTensor,
      timestamp,
      roi
    } = options;

    this.timestamp = timestamp ?? [];
    this.roi = roi ?? [];

    if (tensor) {
      // We received a tensor
      if (keepTensor) {
        // Keep the tensor
        this.tensor = tensor;
      } else {
        // Do not keep the tensor. Convert to raw data:
        const typedData = tensor.dataSync() as Float32Array | Int32Array | Uint8Array;
        const expectedSize = tensor.shape.reduce((a, b) => a * b, 1);
        const exactBuffer = typedData.buffer.slice(
          typedData.byteOffset,
          typedData.byteOffset + typedData.byteLength
        );
        const actualSize = getActualSizeFromRawData(exactBuffer as ArrayBuffer, tensor.dtype);
        if (expectedSize !== actualSize) {
          throw new Error(
            `Mismatch in tensor size: expected ${expectedSize}, but got ${actualSize}`
          );
        }
        this.rawData = exactBuffer as ArrayBuffer;
      }
      this.shape = tensor.shape;
      this.dtype = tensor.dtype;
    
    } else {
      // We received raw data - store it
      if (!rawData || !shape || !dtype) {
        throw new Error(`Frame: rawData, shape, and dtype are required if 'keepTensor' is false.`);
      }
      this.rawData = rawData;
      this.shape = shape;
      this.dtype = dtype;
    }
  }

  /**
   * Creates a Frame from an existing tf.Tensor, optionally keeping the tensor itself.
   * @param tensor The source tensor
   * @param keepTensor If true, store the tf.Tensor directly
   * @param timestamp Optional timestamps
   * @param roi Optional regions of interest
   */
  static fromTensor(
    tensor: tf.Tensor,
    keepTensor = false,
    timestamp?: number[],
    roi?: ROI[]
  ): Frame {
    return new Frame({
      tensor,
      keepTensor,
      shape: tensor.shape,
      dtype: tensor.dtype,
      timestamp,
      roi
    })
  }

  /**
   * Creates a Frame from a Uint8Array (no tf.Tensor involved).
   * @param array The Uint8Array containing data.
   * @param shape The shape of the data (e.g. [nFrames, height, width, channels]).
   * @param timestamp Optional timestamps.
   * @param roi Optional regions of interest.
   */
  static fromUint8Array(
    array: Uint8Array,
    shape: number[],
    timestamp?: number[],
    roi?: ROI[]
  ): Frame {
    const rawData = array.buffer as ArrayBuffer;
    const expectedSize = shape.reduce((a, b) => a * b, 1);
    const actualSize = getActualSizeFromRawData(rawData, 'uint8');

    if (expectedSize !== actualSize) {
      throw new Error(`Mismatch in raw data size: expected ${expectedSize}, but got ${actualSize}`);
    }
    
    return new Frame({
      rawData,
      shape,
      dtype: 'uint8',
      keepTensor: false,
      timestamp,
      roi
    });
  }

  /**
   * Returns a tf.Tensor. If `keepTensor` was true, this will be the same reference
   * originally passed in (unless disposed of). If `keepTensor` was false,
   * this will create a new tensor from raw data each time.
   */
  getTensor(): tf.Tensor {
    if (this.tensor) {
      // We are storing the tensor
      return this.tensor;
    }

    // Otherwise, we must have raw data
    if (!this.rawData || !this.shape || !this.dtype) {
      throw new Error(
        'No tensor stored and insufficient data to create one.'
      );
    }

    let typedArray;
    let tensorDType: tf.DataType = this.dtype;

    if (this.dtype === 'uint8') {
      // Convert uint8 to int32 since tfjs does not support uint8 tensors
      typedArray = new Int32Array(new Uint8Array(this.rawData));
      tensorDType = 'int32'; // Use int32 for compatibility
    } else {
      const TypedArrayClass = this.getTypedArrayClass();
      typedArray = new TypedArrayClass(this.rawData);
    }

    const expectedSize = this.shape.reduce((a, b) => a * b, 1);
    const actualSize = typedArray.length;

    if (expectedSize !== actualSize) {
      throw new Error(
        `Mismatch in tensor size: expected ${expectedSize}, but got ${actualSize}`
      );
    }

    return tf.tensor(typedArray, this.shape, tensorDType);
  }

  /**
   * Increments the reference count when another process needs to use this frame.
   */
  retain(): void {
    this.refCount++;
  }

  /**
   * Decrements the reference count. If it reaches zero, disposes the tensor.
   */
  release(): void {
    this.refCount--;
    if (this.refCount <= 0) {
      this.disposeTensor();
    }
  }

  /**
   * If a tensor is stored, calls tensor.dispose().
   */
  disposeTensor(): void {
    if (this.tensor) {
      this.tensor.dispose();
      this.tensor = undefined;
    }
    this.refCount = 0;
  }

  /**
   * Returns the raw data as a Uint8Array.
   */
  getUint8Array(): Uint8Array {
    if (!this.rawData) {
      throw new Error('No raw data stored.');
    } else if (this.rawData && this.dtype === 'uint8') {
      return new Uint8Array(this.rawData);
    } else {
      const TypedArrayClass = this.getTypedArrayClass();
      const typedArray = new TypedArrayClass(this.rawData!);
  
      return new Uint8Array(typedArray);
    }
  }

  /**
   * Returns the raw data as a Int32Array.
   */
  getInt32Array(): Int32Array {
    if (!this.rawData) {
      throw new Error('No raw data stored.');
    } else if (this.rawData && this.dtype === 'int32') {
      return new Int32Array(this.rawData);
    } else {
      const TypedArrayClass = this.getTypedArrayClass();
      const typedArray = new TypedArrayClass(this.rawData!);
  
      return new Int32Array(typedArray);
    }
  }

  /**
   * Returns the raw data as a Float32Array.
   */
  getFloat32Array(): Float32Array {
    if (!this.rawData) {
      throw new Error('No raw data stored.');
    } else if (this.rawData && this.dtype === 'float32') {
      return new Float32Array(this.rawData);
    } else {
      const TypedArrayClass = this.getTypedArrayClass();
      const typedArray = new TypedArrayClass(this.rawData!);
  
      return new Float32Array(typedArray);
    }
  }

  /**
   * Provides access to the raw data.
   */
  getRawData(): ArrayBuffer | undefined {
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
   * Indicates whether we are storing a tf.Tensor
   */
  hasTensor(): boolean {
    return this.tensor !== undefined;
  }

  /**
   * Utility to figure out which TypedArray we need for a given dtype
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
}
