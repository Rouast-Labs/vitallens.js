import * as tf from '@tensorflow/tfjs';
import { FaceDetectorAsync } from '../../src/ssd/FaceDetectorAsync.browser';
import { Frame } from '../../src/processing/Frame';
import { ROI } from '../../src/types/core';

function areROIsClose(received: ROI[], expected: ROI[], tolerance: number = 1e-6): boolean {
  return received.length === expected.length && received.every((r, i) => {
    const e = expected[i];
    return Math.abs(r.x0 - e.x0) <= tolerance &&
           Math.abs(r.y0 - e.y0) <= tolerance &&
           Math.abs(r.x1 - e.x1) <= tolerance &&
           Math.abs(r.y1 - e.y1) <= tolerance;
  });
}

// Mock TensorFlow.js
jest.mock('@tensorflow/tfjs', () => {
  const actualTf = jest.requireActual('@tensorflow/tfjs');
  return {
    ...actualTf,
    loadGraphModel: jest.fn(),
    io: {
      ...actualTf.io,
      fromMemory: jest.fn(),
    },
  };
});

// Mock the base64-encoded model files
jest.mock('../../models/Ultra-Light-Fast-Generic-Face-Detector-1MB/model.json', () => {
  return 'data:application/json;base64,eyJtb2RlbFRvcG9sb2d5Ijp7InNvbWVWYWx1ZSI6MH0sIndlaWdodHNNYW5pZmVzdCI6W3sid2VpZ2h0cyI6W119XX0=';
});

jest.mock('../../models/Ultra-Light-Fast-Generic-Face-Detector-1MB/group1-shard1of1.bin', () => {
  return 'data:application/octet-stream;base64,AAAAAA==';
});

describe('FaceDetectorAsync.browser', () => {
  let faceDetector: FaceDetectorAsync;

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Mock the in-memory loading
    const mockGraphModel = {
      executeAsync: jest.fn().mockResolvedValue(
        tf.tensor3d([
          [
            [0.1, 0.9, 0.2, 0.2, 0.6, 0.6], // Box 1: [score, class, xMin, yMin, xMax, yMax]
            [0.7, 0.2, 0.3, 0.3, 0.5, 0.5], // Box 2: ...
          ],
        ]) // Shape: [1, N_ANCHORS, 6]
      ),
    } as unknown as tf.GraphModel;

    jest.spyOn(tf.io, 'fromMemory').mockReturnValue('mockedModelSource' as any);
    jest.spyOn(tf, 'loadGraphModel').mockResolvedValue(mockGraphModel);

    // Initialize the FaceDetector
    faceDetector = new FaceDetectorAsync(1, 0.5, 0.3);

    await faceDetector.load();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('should initialize the model from memory', async () => {
    expect(tf.io.fromMemory).toHaveBeenCalledWith(expect.objectContaining({
      modelTopology: expect.any(Object),
      weightSpecs: expect.any(Array),
      weightData: expect.any(ArrayBuffer),
    }));
    expect(tf.loadGraphModel).toHaveBeenCalledWith('mockedModelSource');
  });

  it('should detect faces and return ROIs', async () => {
    const mockData = new Float32Array(224 * 224 * 3).fill(0);
    const mockTensor = tf.tensor4d(mockData, [1, 224, 224, 3]);
    const frame = Frame.fromTensor(mockTensor, true, [0]);

    const results: ROI[] = await faceDetector.detect(frame);

    const expectedResults = [{ x0: 0.2, y0: 0.2, x1: 0.6, y1: 0.6 }];
    expect(areROIsClose(results, expectedResults)).toBe(true);

    mockTensor.dispose();
    frame.disposeTensor();
  });

  it('should call the onFinish callback with results', async () => {
    const mockData = new Float32Array(224 * 224 * 3).fill(0);
    const mockTensor = tf.tensor4d(mockData, [1, 224, 224, 3]);
    const frame = Frame.fromTensor(mockTensor, true, [0]);
    const onFinish = jest.fn();

    await faceDetector.run(frame, onFinish);

    const expectedRois = [{ x0: 0.2, y0: 0.2, x1: 0.6, y1: 0.6 }];
    const actualRois = onFinish.mock.calls[0][0]; // Get the first argument passed to onFinish

    expect(actualRois).toHaveLength(expectedRois.length);

    const tolerance = 1e-6;
    for (let i = 0; i < expectedRois.length; i++) {
      expect(Math.abs(actualRois[i].x0 - expectedRois[i].x0)).toBeLessThan(tolerance);
      expect(Math.abs(actualRois[i].y0 - expectedRois[i].y0)).toBeLessThan(tolerance);
      expect(Math.abs(actualRois[i].x1 - expectedRois[i].x1)).toBeLessThan(tolerance);
      expect(Math.abs(actualRois[i].y1 - expectedRois[i].y1)).toBeLessThan(tolerance);
    }

    mockTensor.dispose();
    frame.disposeTensor();
  });

  it('should throw an error if the model is not loaded', async () => {
    const uninitializedDetector = new FaceDetectorAsync(1, 0.5, 0.3);
    const mockData = new Float32Array(224 * 224 * 3).fill(0);
    const mockTensor = tf.tensor4d(mockData, [1, 224, 224, 3]);
    const frame = Frame.fromTensor(mockTensor, true, [0]);

    (uninitializedDetector as any).model = null;

    await expect(uninitializedDetector.detect(frame)).rejects.toThrow(
      'Face detection model is not loaded.'
    );
    mockTensor.dispose();
    frame.disposeTensor();
  });
});
