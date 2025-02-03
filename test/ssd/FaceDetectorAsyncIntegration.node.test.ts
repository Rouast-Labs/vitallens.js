import * as tf from '@tensorflow/tfjs-node'; // Use tfjs-node for performance and file handling
import * as fs from 'fs/promises';
import * as path from 'path';
import { FaceDetectorAsync } from '../../src/ssd/FaceDetectorAsync.node';
import { Frame } from '../../src/processing/Frame';
import { ROI } from '../../src/types/core';

describe('FaceDetectorAsync (Node) Integration Test', () => {
  let faceDetector: FaceDetectorAsync;

  beforeAll(async () => {
    faceDetector = new FaceDetectorAsync(1, 0.5, 0.3);
    await faceDetector.load();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('should detect faces in a single image', async () => {
    // Load the image file
    const imagePath = path.resolve(__dirname, '../../examples/sample_image_1.png'); // Adjust as needed
    const imageData = await fs.readFile(imagePath); // Read image as a buffer
    const imageTensor = tf.node.decodeImage(new Uint8Array(imageData), 3); // Decode image as RGB

    // Resize the image to match the model's expected input size
    const resizedImage = tf.image.resizeBilinear(imageTensor, [240, 320]); // Resize to [240, 320]
    
    // Create a Frame instance
    const frame = Frame.fromTensor(resizedImage, true, [0]);

    // Run face detection
    const results: ROI[] = await faceDetector.detect(frame);

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
  });

  it('should detect faces in a batch of two images', async () => {
    // Load the image file
    const imagePath = path.resolve(__dirname, '../../examples/sample_image_1.png'); // Adjust as needed
    const imageData = await fs.readFile(imagePath); // Read image as a buffer
    const imageTensor = tf.node.decodeImage(new Uint8Array(imageData), 3); // Decode image as RGB

    // Resize the image to match the model's expected input size
    const resizedImage = tf.image.resizeBilinear(imageTensor, [240, 320]); // Resize to [240, 320]
    const singleImageBatch = resizedImage.expandDims(0) as tf.Tensor4D; // Add batch dimension

    // Create a batch of 2 by concatenating the single image batch
    const batchedImage = tf.concat([singleImageBatch, singleImageBatch], 0); // Batch size 2

    // Create a Frame instance
    const frame = Frame.fromTensor(batchedImage, true, [0, 1]);

    // Run face detection
    const results: ROI[] = await faceDetector.detect(frame);

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
  });
});
