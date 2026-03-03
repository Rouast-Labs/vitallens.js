/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Buffer } from '../../src/processing/Buffer';
import { Frame } from '../../src/processing/Frame';
import { MethodConfig, ROI } from '../../src/types/core';

// Mock Buffer class since it's abstract
class MockBuffer extends Buffer {
  protected async preprocess(
    frame: Frame,
    keepTensor: boolean
  ): Promise<Frame> {
    // Mock preprocessing: return the frame as-is
    return frame;
  }
}

// Mock mergeFrames since we aren't testing arrayOps here
jest.mock('../../src/utils/arrayOps', () => ({
  mergeFrames: jest.fn().mockResolvedValue({
    getShape: () => [4, 1, 3], // Mocked return shape
    release: jest.fn(),
  }),
}));

describe('Buffer', () => {
  let buffer: MockBuffer;
  let roi: ROI;
  let methodConfig: MethodConfig;

  beforeEach(() => {
    roi = { x0: 0, y0: 0, x1: 100, y1: 100 };
    methodConfig = {
      method: 'pos',
      inputSize: 40,
      fpsTarget: 30,
      roiMethod: 'face',
      minWindowLength: 3,
      maxWindowLength: 5,
      requiresState: false,
      bufferOffset: 1,
      supportedVitals: ['heart_rate', 'ppg_waveform'],
    };
    buffer = new MockBuffer(roi, methodConfig);
  });

  afterEach(() => {
    buffer.clear();
    jest.clearAllMocks();
  });

  test('adds frames to the buffer and retains them on add()', async () => {
    const rawData = new Int32Array([1, 2, 3]).buffer;
    const frame = new Frame({
      rawData,
      keepTensor: false,
      shape: [1, 1, 3],
      dtype: 'int32',
      timestamp: [1000],
    });
    await buffer.add(frame);
    expect((buffer as any).buffer.size).toBe(1);
  });

  test('adds frames to the buffer and retains them with overrideRoi on add()', async () => {
    const rawData = new Int32Array([1, 2, 3]).buffer;
    const frame = new Frame({
      rawData,
      keepTensor: false,
      shape: [1, 1, 3],
      dtype: 'int32',
      timestamp: [1000],
    });
    await buffer.add(frame, roi);
    expect((buffer as any).buffer.size).toBe(1);
  });

  test('maintains buffer size within maxWindowLength', async () => {
    for (let i = 0; i < 7; i++) {
      const rawData = new Int32Array([i, i + 1, i + 2]).buffer;
      const frame = new Frame({
        rawData,
        keepTensor: false,
        shape: [1, 1, 3],
        dtype: 'int32',
        timestamp: [i * 1000],
      });
      await buffer.add(frame);
    }

    expect((buffer as any).buffer.size).toBe(methodConfig.maxWindowLength);
  });

  test('returns requested frames and retains overlap on consume()', async () => {
    // Add 5 frames
    for (let i = 0; i < 5; i++) {
      const rawData = new Int32Array([i, i + 1, i + 2]).buffer;
      const frame = new Frame({
        rawData,
        keepTensor: false,
        shape: [1, 1, 3],
        dtype: 'int32',
        timestamp: [i * 1000], // timestamps: 0, 1000, 2000, 3000, 4000
      });
      // Mock release so it doesn't throw when deleted
      jest.spyOn(frame, 'release').mockImplementation(() => {});
      await buffer.add(frame);
    }

    // Consume 4 frames, keep 2 (overlap)
    const consumedFrame = await buffer.consume(4, 2);

    expect(consumedFrame).toBeDefined();
    // The buffer originally had 5 items. We consumed 4 and kept 2 of those 4.
    // That means 2 items were discarded, and 3 items remain (the 2 kept + the 1 not consumed).
    expect((buffer as any).buffer.size).toBe(3);

    // Ensure the remaining keys are the expected ones (timestamps 2000, 3000, 4000)
    const keys = Array.from((buffer as any).buffer.keys()).sort();
    expect(keys).toEqual([2000, 3000, 4000]);
  });

  test('empties the buffer on clear()', async () => {
    for (let i = 0; i < 3; i++) {
      const rawData = new Int32Array([i, i + 1, i + 2]).buffer;
      const frame = new Frame({
        rawData,
        keepTensor: false,
        shape: [1, 1, 3],
        dtype: 'int32',
        timestamp: [i * 1000],
      });
      await buffer.add(frame);
    }

    buffer.clear();
    expect((buffer as any).buffer.size).toBe(0);
  });

  test('calls preprocess() for each added frame', async () => {
    const preprocessSpy = jest.spyOn(buffer as any, 'preprocess');
    const rawData = new Int32Array([1, 2, 3]).buffer;
    const frame = new Frame({
      rawData,
      keepTensor: false,
      shape: [1, 1, 3],
      dtype: 'int32',
      timestamp: [1000],
    });
    await buffer.add(frame);
    expect(preprocessSpy).toHaveBeenCalled();
    preprocessSpy.mockRestore();
  });
});
