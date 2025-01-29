import { FrameBuffer } from '../../src/processing/FrameBuffer';
import { ROI } from '../../src/types/core';
import { Frame } from '../../src/processing/Frame';
import * as tf from '@tensorflow/tfjs';

describe('FrameBuffer', () => {
  let buffer: FrameBuffer;
  let roi: ROI;

  beforeEach(() => {
    roi = { x0: 0, y0: 0, x1: 2, y1: 2 };
    buffer = new FrameBuffer(roi, {
      method: 'vitallens',
      inputSize: 40,
      fpsTarget: 30,
      roiMethod: 'face',
      minWindowLength: 3,
      maxWindowLength: 5,
      requiresState: false,
    });
  });

  afterEach(() => {
    buffer.clear();
    jest.clearAllMocks();
  });

  test('preprocess() crops and resizes frame correctly', async () => {
    const rawData = new Float32Array([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]).buffer;
    const frame = new Frame(rawData, [2, 2, 3], 'float32', [1000]);
    const tensor = frame.getTensor();
    const processedFrame = await (buffer as any).preprocess(tensor, [1000], roi);
    tensor.dispose();
    // Check the processed frame
    expect(processedFrame.getShape()).toEqual([40, 40, 3]); // Resized to 40x40
    expect(processedFrame.getDType()).toBe('float32');
    expect(processedFrame.getTimestamp()).toEqual([1000]);
  });

  test('preprocess() throws error for non-3D tensor frames', async () => {
    const rawData = new Float32Array([1, 2, 3]).buffer;
    const frame = new Frame(rawData, [3], 'float32', [1000]);
    await expect((buffer as any).preprocess(frame, roi)).rejects.toThrow(
      'Frame data must be a 3D tensor. Received rank: 1'
    );
  });

  test('preprocess() throws error for ROI out of bounds', async () => {
    const rawData = new Float32Array([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]).buffer; 
    const frame = new Frame(rawData, [2, 2, 3], 'float32', [1000]);
    const tensor = frame.getTensor();
    const invalidROI: ROI = { x0: 1, y0: 1, x1: 3, y1: 3 };
    await expect((buffer as any).preprocess(tensor, [1000], invalidROI)).rejects.toThrow(
      /ROI dimensions are out of bounds/
    );
    tensor.dispose();
  });

  test('adds and preprocesses frames in the buffer', async () => {
    const rawData = new Float32Array([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]).buffer;
    const frame = new Frame(rawData, [2, 2, 3], 'float32', [1000]);
    const tensor = frame.getTensor() as tf.Tensor3D;
    await buffer.add(tensor, frame.getTimestamp());
    tensor.dispose();
    expect((buffer as any).buffer.size).toBe(1);
    expect(buffer.isReady()).toBe(false);
    for (let i = 1; i < 3; i++) {
      const frame = new Frame(rawData, [2, 2, 3], 'float32', [1000 + i]);
      const tensor = frame.getTensor() as tf.Tensor3D;
      await buffer.add(tensor, frame.getTimestamp());
      tensor.dispose();
    }
    expect(buffer.isReady()).toBe(true);
  });

  test('maintains buffer size within maxWindowLength', async () => {
    const rawData = new Float32Array([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]).buffer;
    for (let i = 0; i < 7; i++) {
      const frame = new Frame(rawData, [2, 2, 3], 'float32', [1000 + i]);
      const tensor = frame.getTensor() as tf.Tensor3D;
      await buffer.add(tensor, frame.getTimestamp());
      tensor.dispose();
    }
    expect((buffer as any).buffer.size).toBe(5);
  });

  test('returns and clears frames beyond minWindowLength on consume()', async () => {
    const rawData = new Float32Array([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]).buffer;
    for (let i = 0; i < 5; i++) {
      const frame = new Frame(rawData, [2, 2, 3], 'float32', [1000 + i]);
      const tensor = frame.getTensor() as tf.Tensor3D;
      await buffer.add(tensor, frame.getTimestamp());
      tensor.dispose();
    }
    const consumedFrames = buffer.consume();
    expect(consumedFrames.length).toBe(5);
    expect((buffer as any).buffer.size).toBe(2);
  });

  test('clears all frames on clear()', async () => {
    const rawData = new Float32Array([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]).buffer;
    for (let i = 0; i < 3; i++) {
      const frame = new Frame(rawData, [2, 2, 3], 'float32', [1000 + i]);
      const tensor = frame.getTensor() as tf.Tensor3D;
      await buffer.add(tensor, frame.getTimestamp());
      tensor.dispose();
    }
    buffer.clear();
    expect((buffer as any).buffer.size).toBe(0);
  });
});
