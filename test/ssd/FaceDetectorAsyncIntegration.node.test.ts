import * as tf from '@tensorflow/tfjs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { FaceDetectorAsync } from '../../src/ssd/FaceDetectorAsync.node';
import { Frame } from '../../src/processing/Frame';
import { ROI } from '../../src/types/core';
import { PNG } from 'pngjs';
import { describe, expect, beforeAll, afterAll, vi, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('FaceDetectorAsync (Node) Integration Test', () => {
  let faceDetector: FaceDetectorAsync;

  beforeAll(async () => {
    faceDetector = new FaceDetectorAsync(1, 0.5, 0.3);
    await faceDetector.load();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('should detect faces in a single image', async () => {
    // Load the image file
    const imagePath = path.resolve(
      __dirname,
      '../../examples/sample_image_1.png'
    ); // Adjust as needed
    const imageData = await fs.readFile(imagePath);
    const png = PNG.sync.read(imageData);

    // Convert RGBA to RGB
    const rgbData = new Uint8Array(png.width * png.height * 3);
    for (let i = 0; i < png.width * png.height; i++) {
      rgbData[i * 3] = png.data[i * 4];
      rgbData[i * 3 + 1] = png.data[i * 4 + 1];
      rgbData[i * 3 + 2] = png.data[i * 4 + 2];
    }

    const imageTensor = tf.tensor3d(
      rgbData,
      [png.height, png.width, 3],
      'int32'
    );

    // Resize the image to match the model's expected input size
    const resizedImage = tf.image.resizeBilinear(imageTensor, [240, 320]); // Resize to [240, 320]

    // Create a Frame instance
    const frame = Frame.fromTensor(resizedImage, true, [0]);

    // Run face detection
    const results: ROI[] = await faceDetector.detect(frame, 1.0);

    // Validate results
    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBe(1); // Ensure at least one detection
    results.forEach((roi) => {
      expect(roi).toHaveProperty('x0');
      expect(roi).toHaveProperty('y0');
      expect(roi).toHaveProperty('x1');
      expect(roi).toHaveProperty('y1');
    });

    // Clean up
    imageTensor.dispose();
    resizedImage.dispose();
    frame.disposeTensor();
  }, 30000);

  it('should detect faces in a batch of two images', async () => {
    // Load the image file
    const imagePath = path.resolve(
      __dirname,
      '../../examples/sample_image_1.png'
    ); // Adjust as needed
    const imageData = await fs.readFile(imagePath);
    const png = PNG.sync.read(imageData);

    // Convert RGBA to RGB
    const rgbData = new Uint8Array(png.width * png.height * 3);
    for (let i = 0; i < png.width * png.height; i++) {
      rgbData[i * 3] = png.data[i * 4];
      rgbData[i * 3 + 1] = png.data[i * 4 + 1];
      rgbData[i * 3 + 2] = png.data[i * 4 + 2];
    }

    const imageTensor = tf.tensor3d(
      rgbData,
      [png.height, png.width, 3],
      'int32'
    );

    // Resize the image to match the model's expected input size
    const resizedImage = tf.image.resizeBilinear(imageTensor, [240, 320]); // Resize to [240, 320]
    const singleImageBatch = resizedImage.expandDims(0) as tf.Tensor4D; // Add batch dimension

    // Create a batch of 2 by concatenating the single image batch
    const batchedImage = tf.concat([singleImageBatch, singleImageBatch], 0); // Batch size 2

    // Create a Frame instance
    const frame = Frame.fromTensor(batchedImage, true, [0, 1]);

    // Run face detection
    const results: ROI[] = await faceDetector.detect(frame, 1.0);

    // Validate results
    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBe(2); // Ensure at least one detection
    results.forEach((roi) => {
      expect(roi).toHaveProperty('x0');
      expect(roi).toHaveProperty('y0');
      expect(roi).toHaveProperty('x1');
      expect(roi).toHaveProperty('y1');
    });

    // Clean up
    imageTensor.dispose();
    resizedImage.dispose();
    singleImageBatch.dispose();
    batchedImage.dispose();
    frame.disposeTensor();
  }, 30000);
});
