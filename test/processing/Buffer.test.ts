import { Buffer } from '../../src/processing/Buffer';
import { Frame } from '../../src/processing/Frame';
import { ROI } from '../../src/types/core';
import { MethodConfig } from '../../src/config/methodsConfig';
import * as tf from '@tensorflow/tfjs';

// Mock Buffer class since it's abstract
class MockBuffer extends Buffer {
  protected async preprocess(frame: Frame, roi: ROI, methodConfig: MethodConfig): Promise<Frame> {
    // Mock preprocessing returns the same frame
    return frame;
  }
}

describe('Buffer', () => {
  let buffer: MockBuffer;
  let roi: ROI;
  let methodConfig: MethodConfig;

  beforeEach(() => {
    roi = { x: 0, y: 0, width: 100, height: 100 };
    methodConfig = { method: 'pos', inputSize: 40, fpsTarget: 30, roiMethod: 'face', minWindowLength: 3, maxWindowLength: 5, windowOverlap: 2, requiresState: false };
    buffer = new MockBuffer(roi, methodConfig);
  });

  afterEach(() => {
    buffer.clear();
  });

  test('adds frames to the buffer and retains them', async () => {
    const frame = new Frame(tf.tensor([[[1, 2, 3]]], [1, 1, 3]), [1000]);

    await buffer.add(frame, frame.timestamp[0]);

    expect(buffer.isReady()).toBe(false);
    expect(buffer["buffer"].size).toBe(1);
    frame.release(); // Clean up reference count
  });

  test('buffer is ready when minimum frames are added', async () => {
    for (let i = 0; i < 3; i++) {
      const frame = new Frame(tf.tensor([[[i]]], [1, 1, 1]), [i * 1000]);
      await buffer.add(frame, frame.timestamp[0]);
      frame.release();
    }

    expect(buffer.isReady()).toBe(true);
  });

  test('maintains buffer size within maxFrames', async () => {
    for (let i = 0; i < 7; i++) {
      const frame = new Frame(tf.tensor([[[i]]], [1, 1, 1]), [i * 1000]);
      await buffer.add(frame, frame.timestamp[0]);
      frame.release();
    }

    expect(buffer["buffer"].size).toBe(5); // maxFrames is 5
  });

  test('consume returns and clears frames beyond minFrames', async () => {
    for (let i = 0; i < 5; i++) {
      const frame = new Frame(tf.tensor([[[i]]], [1, 1, 1]), [i * 1000]);
      await buffer.add(frame, frame.timestamp[0]);
      frame.release();
    }

    const consumedFrames = buffer.consume();

    expect(consumedFrames.length).toBe(5);
    expect(buffer["buffer"].size).toBe(3); // minFrames is 3
  });

  test('clear releases all frames and empties buffer', async () => {
    for (let i = 0; i < 3; i++) {
      const frame = new Frame(tf.tensor([[[i]]], [1, 1, 1]), [i * 1000]);
      await buffer.add(frame, frame.timestamp[0]);
      frame.release();
    }

    buffer.clear();

    expect(buffer["buffer"].size).toBe(0);
  });

  test('preprocess is called for each added frame', async () => {
    const preprocessSpy = jest.spyOn(buffer as any, 'preprocess');

    const frame = new Frame(tf.tensor([[[1, 2, 3]]], [1, 1, 3]), [1000]);
    await buffer.add(frame, frame.timestamp[0]);

    expect(preprocessSpy).toHaveBeenCalledWith(frame, roi, methodConfig);
    preprocessSpy.mockRestore();
    frame.release();
  });
});
