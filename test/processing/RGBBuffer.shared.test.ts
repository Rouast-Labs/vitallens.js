import { RGBBuffer } from '../../src/processing/RGBBuffer';
import { ROI } from '../../src/types/core';
import { Frame } from '../../src/processing/Frame';

describe('RGBBuffer', () => {
  let buffer: RGBBuffer;
  let roi: ROI;

  beforeEach(() => {
    roi = { x0: 0, y0: 0, x1: 2, y1: 2 };
    buffer = new RGBBuffer(roi, {
      method: 'pos',
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

  test('preprocess() crops and averages frame correctly', async () => {
    const rawData = new Float32Array([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]).buffer;
    const frame = new Frame(rawData, [2, 2, 3], 'float32', [1000]);

    const processedFrame = await (buffer as any).preprocess(frame, roi);

    expect(processedFrame.getShape()).toEqual([3]);
    expect(processedFrame.getDType()).toBe('float32');
    expect(processedFrame.getTimestamp()).toEqual([1000]);
    const tensorData = processedFrame.getTensor().dataSync();
    expect(tensorData).toEqual(new Float32Array([5.5, 6.5, 7.5]));
  });

  test('preprocess() throws error for non-3D tensor frames', async () => {
    const rawData = new Float32Array([1, 2, 3]).buffer; // Shape [3]
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

    const invalidROI: ROI = { x0: 1, y0: 1, x1: 3, y1: 3 }; // Exceeds bounds

    await expect((buffer as any).preprocess(frame, invalidROI)).rejects.toThrow(
      /ROI dimensions are out of bounds/
    );
  });

  test('adds and preprocesses frames in the buffer', async () => {
    const rawData = new Float32Array([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]).buffer;
    const frame = new Frame(rawData, [2, 2, 3], 'float32', [1000]);

    await buffer.add(frame);

    expect((buffer as any).buffer.size).toBe(1);
    expect(buffer.isReady()).toBe(false);

    for (let i = 1; i < 3; i++) {
      const frame = new Frame(rawData, [2, 2, 3], 'float32', [1000 + i]);
      await buffer.add(frame);
    }

    expect(buffer.isReady()).toBe(true);
  });

  test('maintains buffer size within maxWindowLength', async () => {
    const rawData = new Float32Array([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]).buffer;

    for (let i = 0; i < 7; i++) {
      const frame = new Frame(rawData, [2, 2, 3], 'float32', [1000 + i]);
      await buffer.add(frame);
    }

    expect((buffer as any).buffer.size).toBe(5);
  });

  test('returns and clears frames beyond minWindowLength on consume()', async () => {
    const rawData = new Float32Array([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]).buffer;

    for (let i = 0; i < 5; i++) {
      const frame = new Frame(rawData, [2, 2, 3], 'float32', [1000 + i]);
      await buffer.add(frame);
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
      await buffer.add(frame);
    }

    buffer.clear();

    expect((buffer as any).buffer.size).toBe(0);
  });
});
