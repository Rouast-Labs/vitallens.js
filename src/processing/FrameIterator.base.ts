import { IFrameIterator } from "../types/IFrameIterator";
import { Frame } from "./Frame";
import { v4 as uuidv4 } from 'uuid';

/**
 * Abstract base class for frame iterators.
 * Handles the logic for extracting frames from a source (e.g., MediaStream or file).
 * Implements IFrameIterator to expose ID functionality.
 */
export abstract class FrameIteratorBase implements IFrameIterator {
  protected isClosed = false;
  private id: string;

  constructor() {
    // Generate a unique ID for each iterator
    this.id = uuidv4();
  }

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

  /**
   * Returns the unique ID of this iterator.
   * @returns The unique ID string.
   */
  getId(): string {
    return this.id;
  }
}
