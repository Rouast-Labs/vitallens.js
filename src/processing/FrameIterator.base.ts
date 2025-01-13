import { Tensor } from '@tensorflow/tfjs-core';

/**
 * Abstract base class for frame iterators.
 * Handles the logic for extracting frames from a source (e.g., MediaStream or file).
 */
export abstract class FrameIteratorBase implements AsyncIterable<Tensor> {
  protected isClosed = false;

  /**
   * Starts the iterator by initializing resources (e.g., stream or file reader).
   */
  abstract start(): Promise<void>;

  /**
   * Stops the iterator by releasing resources.
   */
  stop(): void {
    this.isClosed = true;
  }

  /**
   * Abstract method for retrieving the next tensor frame.
   * @returns A promise resolving to the next tensor or null if the iterator is stopped.
   */
  abstract next(): Promise<Tensor | null>;

  /**
   * Implements the async iterator protocol.
   * @returns An async iterator for frames.
   */
  [Symbol.asyncIterator](): AsyncIterator<Tensor> {
    return {
      next: async () => {
        if (this.isClosed) {
          return { value: null, done: true };
        }
        const frame = await this.next();
        if (frame === null) {
          this.stop();
          return { value: null, done: true };
        }
        return { value: frame, done: false };
      },
    };
  }
}
