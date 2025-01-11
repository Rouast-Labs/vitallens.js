import { Frame } from '../types/core';

/**
 * Abstract base class for frame iterators.
 * Handles the logic for extracting frames from a source (e.g., MediaStream or file).
 */
export abstract class FrameIteratorBase implements AsyncIterable<Frame> {
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
   * Abstract method for retrieving the next frame.
   * @returns A promise resolving to the next frame or null if the iterator is stopped.
   */
  abstract next(): Promise<Frame | null>;

  /**
   * Implements the async iterator protocol.
   * @returns An async iterator for frames.
   */
  [Symbol.asyncIterator](): AsyncIterator<Frame> {
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
