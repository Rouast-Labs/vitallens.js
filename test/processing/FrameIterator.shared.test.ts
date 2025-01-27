import { FrameIteratorBase } from '../../src/processing/FrameIterator.base';
import { Frame } from '../../src/processing/Frame';
import { v4 as uuidv4 } from 'uuid';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-unique-id'),
}));

describe('FrameIteratorBase', () => {
  class MockFrameIterator extends FrameIteratorBase {
    private frameQueue: Frame[];

    constructor(frames: Frame[]) {
      super();
      this.frameQueue = frames;
    }

    async start(): Promise<void> {
      // Simulate starting resources (e.g., streams)
      this.isClosed = false;
    }

    async next(): Promise<Frame | null> {
      return this.isClosed || this.frameQueue.length === 0
        ? null
        : this.frameQueue.shift() || null;
    }
  }

  let mockFrames: Frame[];

  beforeEach(() => {
    mockFrames = [
      new Frame(new ArrayBuffer(8), [2, 2], 'int32', [0]),
      new Frame(new ArrayBuffer(16), [4, 4], 'float32', [1]),
    ];
  });

  test('getId should return a unique ID', () => {
    const iterator = new MockFrameIterator(mockFrames);
    expect(iterator.getId()).toBe('mock-unique-id');
    expect(uuidv4).toHaveBeenCalled();
  });

  test('start should reset isClosed to false', async () => {
    const iterator = new MockFrameIterator(mockFrames);
    iterator.stop(); // Set isClosed to true
    await iterator.start();
    expect((iterator as any).isClosed).toBe(false);
  });

  test('stop should set isClosed to true', () => {
    const iterator = new MockFrameIterator(mockFrames);
    iterator.stop();
    expect((iterator as any).isClosed).toBe(true);
  });

  test('[Symbol.asyncIterator] should yield frames until isClosed is true or no frames remain', async () => {
    const iterator = new MockFrameIterator(mockFrames);
    const frames: Frame[] = [];

    for await (const frame of iterator) {
      frames.push(frame);
    }

    expect(frames.length).toBe(2);
    expect(frames[0].getShape()).toEqual([2, 2]);
    expect(frames[1].getShape()).toEqual([4, 4]);
  });

  test('[Symbol.asyncIterator] should stop iterating if isClosed is true', async () => {
    const iterator = new MockFrameIterator(mockFrames);
    const frames: Frame[] = [];

    iterator.stop(); // Set isClosed to true

    for await (const frame of iterator) {
      frames.push(frame);
    }

    expect(frames.length).toBe(0);
  });

  test('[Symbol.asyncIterator] should stop iterating when next() returns null', async () => {
    const iterator = new MockFrameIterator([]); // Empty frame queue
    const frames: Frame[] = [];

    for await (const frame of iterator) {
      frames.push(frame);
    }

    expect(frames.length).toBe(0);
  });
});
