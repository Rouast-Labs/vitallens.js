/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import * as tf from '@tensorflow/tfjs-core';
import { FrameBuffer, downsample } from '../../src/processing/FrameBuffer';
import { ROI } from '../../src/types/core';
import { Frame } from '../../src/processing/Frame';
import { describe, expect, beforeEach, vi, test, afterEach } from 'vitest';

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
      bufferOffset: 1,
      supportedVitals: ['heart_rate', 'ppg_waveform'],
    });
  });

  afterEach(() => {
    buffer.clear();
    vi.clearAllMocks();
  });

  test('preprocess() crops and resizes frame correctly', async () => {
    const rawData = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
      .buffer;
    const frame = new Frame({
      rawData,
      keepTensor: false,
      shape: [2, 2, 3],
      dtype: 'float32',
      timestamp: [1000],
    });
    const processedFrame = await (buffer as any).preprocess(frame, false);
    // Check the processed frame
    expect(processedFrame.getShape()).toEqual([40, 40, 3]); // Resized to 40x40
    expect(processedFrame.getDType()).toBe('float32');
    expect(processedFrame.getTimestamp()).toEqual([1000]);
  });

  test('preprocess() throws error for non-3D tensor frames', async () => {
    const rawData = new Float32Array([1, 2, 3]).buffer;
    const frame = new Frame({
      rawData,
      keepTensor: false,
      shape: [3],
      dtype: 'float32',
      timestamp: [1000],
    });
    await expect((buffer as any).preprocess(frame, false)).rejects.toThrow(
      'Frame data must be a 3D tensor. Received rank: 1'
    );
  });

  test('preprocess() throws error for ROI out of bounds', async () => {
    const rawData = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
      .buffer;
    const invalidROI: ROI = { x0: 1, y0: 1, x1: 3, y1: 3 };
    (buffer as any).roi = invalidROI;
    const frame = new Frame({
      rawData,
      keepTensor: false,
      shape: [2, 2, 3],
      dtype: 'float32',
      timestamp: [1000],
    });
    await expect((buffer as any).preprocess(frame, false)).rejects.toThrow(
      /ROI dimensions are out of bounds/
    );
  });

  test('adds and preprocesses frames in the buffer', async () => {
    const rawData = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
      .buffer;
    const frame = new Frame({
      rawData,
      keepTensor: false,
      shape: [2, 2, 3],
      dtype: 'float32',
      timestamp: [1000],
    });
    await buffer.add(frame);
    expect((buffer as any).buffer.size).toBe(1);

    for (let i = 1; i < 3; i++) {
      const loopFrame = new Frame({
        rawData,
        keepTensor: false,
        shape: [2, 2, 3],
        dtype: 'float32',
        timestamp: [1000 + i],
      });
      await buffer.add(loopFrame);
    }
    expect((buffer as any).buffer.size).toBe(3);
  });

  test('maintains buffer size within maxWindowLength', async () => {
    const rawData = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
      .buffer;
    for (let i = 0; i < 7; i++) {
      const frame = new Frame({
        rawData,
        keepTensor: false,
        shape: [2, 2, 3],
        dtype: 'float32',
        timestamp: [1000 + i],
      });
      await buffer.add(frame);
    }
    expect((buffer as any).buffer.size).toBe(5);
  });

  test('returns and retains overlap on consume()', async () => {
    const rawData = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
      .buffer;
    for (let i = 0; i < 5; i++) {
      const frame = new Frame({
        rawData,
        keepTensor: false,
        shape: [2, 2, 3],
        dtype: 'float32',
        timestamp: [1000 + i],
      });
      vi.spyOn(frame, 'release').mockImplementation(() => {});
      await buffer.add(frame);
    }

    const consumedFrames = await buffer.consume(4, 2);
    expect(consumedFrames!.getShape()[0]).toBe(4);
    expect((buffer as any).buffer.size).toBe(3); // 5 total - 4 consumed + 2 kept
  });

  test('clears all frames on clear()', async () => {
    const rawData = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
      .buffer;
    for (let i = 0; i < 3; i++) {
      const frame = new Frame({
        rawData,
        keepTensor: false,
        shape: [2, 2, 3],
        dtype: 'float32',
        timestamp: [1000 + i],
      });
      await buffer.add(frame);
    }
    buffer.clear();
    expect((buffer as any).buffer.size).toBe(0);
  });
});

describe('downsample', () => {
  test('averages exact blocks when the size is an integer multiple', () => {
    const image = tf.randomUniform([120, 160, 3], 0, 255) as tf.Tensor3D;
    const out = downsample(image, 40);
    const expected = image
      .reshape([40, 3, 40, 4, 3])
      .mean([1, 3]) as tf.Tensor3D;
    expect(out.shape).toEqual([40, 40, 3]);
    expect(tf.max(tf.abs(tf.sub(out, expected))).dataSync()[0]).toBeLessThan(
      1e-3
    );
  });

  test('averages out pixel noise at large downscale factors', () => {
    // 300 -> 40: a box covers about 7.5 x 7.5 px, so noise sd drops by about 7
    const image = tf.randomNormal([300, 300, 3], 128, 20) as tf.Tensor3D;
    const sd = (t: tf.Tensor) =>
      Math.sqrt(tf.moments(t).variance.dataSync()[0]);
    expect(sd(downsample(image, 40))).toBeLessThan(4);
    expect(sd(tf.image.resizeBilinear(image, [40, 40]))).toBeGreaterThan(8);
  });

  test('uses bilinear resizing up to 2x downscaling', () => {
    const image = tf.ones([80, 60, 3]) as tf.Tensor3D;
    const out = downsample(image, 40);
    expect(out.shape).toEqual([40, 40, 3]);
    expect(tf.min(out).dataSync()[0]).toBeCloseTo(1, 6);
  });
});
