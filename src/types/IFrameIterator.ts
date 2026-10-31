import { Frame } from '../processing/Frame';

export interface IFrameIterator extends AsyncIterable<Frame> {
  getId(): string;
  start(): Promise<void>;
  stop(): void;
  /** Whether the iterator delivers frames as they are captured, paced by setFrameInterval. */
  isFramePaced?(): boolean;
  setFrameInterval?(seconds: number): void;
}
