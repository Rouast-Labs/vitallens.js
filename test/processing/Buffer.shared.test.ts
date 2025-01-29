import { Buffer } from '../../src/processing/Buffer';
import { Frame } from '../../src/processing/Frame';
import { MethodConfig, ROI } from '../../src/types/core';
import * as tf from '@tensorflow/tfjs';

// Mock Buffer class since it's abstract
class MockBuffer extends Buffer {
  protected async preprocess(tensor: tf.Tensor3D, timestamp: number[], roi: ROI): Promise<Frame> {
    // Mock preprocessing: return the frame as-is
    return Frame.fromTensor(tensor, timestamp);
  }
}

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
    };
    buffer = new MockBuffer(roi, methodConfig);
  });

  afterEach(() => {
    buffer.clear();
  });

  test('adds frames to the buffer and retains them on add()', async () => {
    const rawData = new Int32Array([1, 2, 3]).buffer;
    const frame = new Frame(rawData, [1, 1, 3], 'int32', [1000]);
    const tensor = frame.getTensor() as tf.Tensor3D;
    await buffer.add(tensor, frame.getTimestamp());
    expect(buffer.isReady()).toBe(false);
    expect((buffer as any).buffer.size).toBe(1);
    tensor.dispose();
  });

  test('buffer isReady() when minimum frames are added', async () => {
    for (let i = 0; i < methodConfig.minWindowLength; i++) {
      const rawData = new Int32Array([i, i + 1, i + 2]).buffer;
      const frame = new Frame(rawData, [1, 1, 3], 'int32', [i * 1000]);
      const tensor = frame.getTensor() as tf.Tensor3D;
      await buffer.add(tensor, frame.getTimestamp());
      tensor.dispose();
    }

    expect(buffer.isReady()).toBe(true);
  });

  test('maintains buffer size within maxWindowLength', async () => {
    for (let i = 0; i < 7; i++) {
      const rawData = new Int32Array([i, i + 1, i + 2]).buffer;
      const frame = new Frame(rawData, [1, 1, 3], 'int32', [i * 1000]);
      const tensor = frame.getTensor() as tf.Tensor3D;
      await buffer.add(tensor, frame.getTimestamp());
      tensor.dispose();
    }

    expect((buffer as any).buffer.size).toBe(methodConfig.maxWindowLength);
  });

  test('returns and clears frames beyond minWindowLength on consume()', async () => {
    for (let i = 0; i < 5; i++) {
      const rawData = new Int32Array([i, i + 1, i + 2]).buffer;
      const frame = new Frame(rawData, [1, 1, 3], 'int32', [i * 1000]);
      const tensor = frame.getTensor() as tf.Tensor3D;
      await buffer.add(tensor, frame.getTimestamp());
      tensor.dispose();
    }

    const consumedFrames = buffer.consume();
    expect(consumedFrames.length).toBe(methodConfig.maxWindowLength);
    expect((buffer as any).buffer.size).toBe(methodConfig.minWindowLength-1);
  });

  test('empties the buffer on clear()', async () => {
    for (let i = 0; i < 3; i++) {
      const rawData = new Int32Array([i, i + 1, i + 2]).buffer;
      const frame = new Frame(rawData, [1, 1, 3], 'int32', [i * 1000]);
      const tensor = frame.getTensor() as tf.Tensor3D;
      await buffer.add(tensor, frame.getTimestamp());
      tensor.dispose();
    }

    buffer.clear();
    expect((buffer as any).buffer.size).toBe(0);
  });

  test('calls preprocess() for each added frame', async () => {
    const preprocessSpy = jest.spyOn(buffer as any, 'preprocess');
    const rawData = new Int32Array([1, 2, 3]).buffer;
    const frame = new Frame(rawData, [1, 1, 3], 'int32', [1000]);
    const tensor = frame.getTensor() as tf.Tensor3D;
    await buffer.add(tensor, frame.getTimestamp());
    tensor.dispose();
    expect(preprocessSpy).toHaveBeenCalled();
    preprocessSpy.mockRestore();
  });

  test('isReadyState() returns true when buffer size meets minWindowLengthState', async () => {
    methodConfig.minWindowLengthState = 2;
    buffer = new MockBuffer(roi, methodConfig);
    for (let i = 0; i < 2; i++) { // minWindowLengthState is 2
      const rawData = new Int32Array([i, i + 1, i + 2]).buffer;
      const frame = new Frame(rawData, [1, 1, 3], 'int32', [i * 1000]);
      const tensor = frame.getTensor() as tf.Tensor3D;
      await buffer.add(tensor, frame.getTimestamp());
      tensor.dispose();
    }

    expect(buffer.isReadyState()).toBe(true);
  });
});
