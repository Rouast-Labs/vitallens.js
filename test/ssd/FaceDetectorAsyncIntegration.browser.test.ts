import * as tf from '@tensorflow/tfjs';
import { FaceDetectorAsync } from '../../src/ssd/FaceDetectorAsync.browser';
import { Frame } from '../../src/processing/Frame';
import { ROI } from '../../src/types/core';
import { getTestImageFrame } from './jest.setup.image';

describe('FaceDetectorAsync (Browser) Integration Test', () => {
  let faceDetector: FaceDetectorAsync;

  beforeAll(async () => {
    faceDetector = new FaceDetectorAsync(1, 0.5, 0.3);
    await faceDetector.load();
  });

  it('should detect faces in a single image', async () => {
    const frame = getTestImageFrame();

    const results: ROI[] = await faceDetector.detect(frame);

    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBe(1);
    results.forEach((roi) => {
      expect(roi).toHaveProperty('x0');
      expect(roi).toHaveProperty('y0');
      expect(roi).toHaveProperty('x1');
      expect(roi).toHaveProperty('y1');
    });

  });

  it('should detect faces in a batch of two images', async () => {

    const imageTensor = getTestImageFrame().getTensor();
    const singleImageBatch = imageTensor.expandDims(0) as tf.Tensor4D;

    const batchedImage = tf.concat([singleImageBatch, singleImageBatch], 0);
    const frame = Frame.fromTensor(batchedImage, [0, 1]);

    const results: ROI[] = await faceDetector.detect(frame);

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
  }, 60000);
});
