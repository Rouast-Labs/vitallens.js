import * as tf from '@tensorflow/tfjs';

/**
 * Represents a single frame in the video processing pipeline.
 */
export class Frame {
  data: tf.Tensor;
  timestamp: number[]; // In seconds
  private refCount: number = 0;

  constructor(data: tf.Tensor, timestamp: number[]) {
    this.data = data;
    this.timestamp = timestamp;
    this.refCount = 0;
  }

  /**
   * Increases the reference count.
   */
  retain(): void {
    this.refCount++;
  }

  /**
   * Decreases the reference count and disposes of the frame if no references remain.
   */
  release(): void {
    this.refCount--;
    if (this.refCount <= 0) {
      this.dispose();
    }
  }

  /**
   * Disposes of the tensor data associated with the frame.
   */
  private dispose(): void {
    if (this.data) {
      this.data.dispose();
    }
  }
}
