import * as tf from '@tensorflow/tfjs';
import { FaceDetectorAsync } from '../../src/ssd/FaceDetectorAsync.browser';
import { Frame } from '../../src/processing/Frame';
import { ROI } from '../../src/types/core';
import { getTestImageFrame } from './vi.setup.image';
import { describe, expect, beforeAll, afterAll, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

vi.mock('../../src/ssd/modelAssets', () => ({
  modelJsonPath: 'mock-model.json',
  modelBinPath: 'mock-model.bin',
}));

describe('FaceDetectorAsync (Browser) Integration Test', () => {
  let faceDetector: FaceDetectorAsync;

  beforeAll(async () => {
    globalThis.fetch = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = input.toString();
        if (url.includes('mock-model.json')) {
          const data = fs.readFileSync(
            path.resolve(
              __dirname,
              '../../models/Ultra-Light-Fast-Generic-Face-Detector-1MB/model.json'
            ),
            'utf8'
          );
          return { json: async () => JSON.parse(data) } as Response;
        }
        if (url.includes('mock-model.bin')) {
          const data = fs.readFileSync(
            path.resolve(
              __dirname,
              '../../models/Ultra-Light-Fast-Generic-Face-Detector-1MB/group1-shard1of1.bin'
            )
          );
          return { arrayBuffer: async () => data.buffer } as Response;
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      }
    ) as unknown as typeof fetch;

    faceDetector = new FaceDetectorAsync(1, 0.5, 0.3);
    await faceDetector.load();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('should detect faces in a single image', async () => {
    const frame = getTestImageFrame();

    const results: ROI[] = await faceDetector.detect(frame, 1.0);

    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBe(1);
    results.forEach((roi) => {
      expect(roi).toHaveProperty('x0');
      expect(roi).toHaveProperty('y0');
      expect(roi).toHaveProperty('x1');
      expect(roi).toHaveProperty('y1');
    });
  }, 30000);

  it('should detect faces in a batch of two images', async () => {
    const imageTensor = getTestImageFrame().getTensor();
    const singleImageBatch = imageTensor.expandDims(0) as tf.Tensor4D;

    const batchedImage = tf.concat([singleImageBatch, singleImageBatch], 0);
    const frame = Frame.fromTensor(batchedImage, true, [0, 1]);

    const results: ROI[] = await faceDetector.detect(frame, 1.0);

    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBe(2);
    results.forEach((roi) => {
      expect(roi).toHaveProperty('x0');
      expect(roi).toHaveProperty('y0');
      expect(roi).toHaveProperty('x1');
      expect(roi).toHaveProperty('y1');
    });

    imageTensor.dispose();
    singleImageBatch.dispose();
    batchedImage.dispose();
    frame.disposeTensor();
  }, 30000);
});
