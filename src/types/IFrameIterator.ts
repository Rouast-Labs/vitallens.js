import { Frame } from '../processing/Frame';

export interface IFrameIterator extends AsyncIterable<Frame> {
  getId(): string;
  start(): Promise<void>;
  stop(): void;
}
