import * as tf from '@tensorflow/tfjs';
import { FaceDetectorAsync } from '../../src/ssd/FaceDetectorAsync';
import { Frame } from '../../src/processing/Frame';
import { ROI } from '../../src/types/core';

function areROIsClose(received: ROI[], expected: ROI[], tolerance: number = 1e-6): boolean {
  return received.length === expected.length && received.every((r, i) => {
    const e = expected[i];
    return Math.abs(r.x - e.x) <= tolerance &&
           Math.abs(r.y - e.y) <= tolerance &&
           Math.abs(r.width - e.width) <= tolerance &&
           Math.abs(r.height - e.height) <= tolerance;
  });
}

jest.mock('@tensorflow/tfjs', () => {
  const actualTf = jest.requireActual('@tensorflow/tfjs');
  return {
    ...actualTf,
    loadGraphModel: jest.fn(),
    image: {
      nonMaxSuppressionAsync: jest.fn(),
    },
  };
});

describe('FaceDetector', () => {
  let faceDetector: FaceDetectorAsync;

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  
    // Create a mock GraphModel
    const mockGraphModel = {
      executeAsync: jest.fn().mockResolvedValue(
        tf.tensor3d([
          [
            [0.9, 0.1, 0.2, 0.2, 0.6, 0.6],
            [0.7, 0.2, 0.3, 0.3, 0.5, 0.5],
          ],
        ]), // Shape: [1, N_ANCHORS, 6]
      ),
    } as unknown as tf.GraphModel;
  
    jest.spyOn(tf, 'loadGraphModel').mockResolvedValue(mockGraphModel);
  
    // Mock nonMaxSuppressionAsync to simulate selected indices
    jest.spyOn(tf.image, 'nonMaxSuppressionAsync').mockResolvedValue(
      tf.tensor1d([0]) // Assume the first box is selected
    );
  
    // Initialize the FaceDetector
    faceDetector = new FaceDetectorAsync(1, 0.5, 0.3);
  });
  

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('should initialize with the correct parameters', async () => {
    await new Promise((resolve) => setTimeout(resolve, 100)); // Allow time for async init in the constructor
    expect(tf.loadGraphModel).toHaveBeenCalledWith(
      'file:///Users/prouast/Developer/vitallens.js/models/Ultra-Light-Fast-Generic-Face-Detector-1MB/model.json'
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('FaceDetector initialized')
    );
  });

  it('should detect faces and return ROIs', async () => {
    const mockData = new Float32Array(224 * 224 * 3).fill(0);
    const mockTensor = tf.tensor4d(mockData, [1, 224, 224, 3]);
    const frame = new Frame(mockTensor, [0]);
  
    const results: ROI[] = await faceDetector.detect(frame);
  
    const expectedResults = [{ x: 0.2, y: 0.2, width: 0.4, height: 0.4 }];
    expect(areROIsClose(results, expectedResults)).toBe(true);
    expect(tf.image.nonMaxSuppressionAsync).toHaveBeenCalled();
  
    mockTensor.dispose();
  });

  it('should call the onFinish callback with results', async () => {
    const mockData = new Float32Array(224 * 224 * 3).fill(0);
    const mockTensor = tf.tensor4d(mockData, [1, 224, 224, 3]);
    const frame = new Frame(mockTensor, [0]);
    const onFinish = jest.fn();
  
    await faceDetector.run(frame, onFinish);
  
    const expectedRois = [{ x: 0.2, y: 0.2, width: 0.4, height: 0.4 }];
    const actualRois = onFinish.mock.calls[0][0]; // Get the first argument passed to onFinish
  
    expect(actualRois).toHaveLength(expectedRois.length);
  
    // Compare each ROI with a tolerance
    const tolerance = 1e-6; // Adjust as needed
    for (let i = 0; i < expectedRois.length; i++) {
      expect(Math.abs(actualRois[i].x - expectedRois[i].x)).toBeLessThan(tolerance);
      expect(Math.abs(actualRois[i].y - expectedRois[i].y)).toBeLessThan(tolerance);
      expect(Math.abs(actualRois[i].width - expectedRois[i].width)).toBeLessThan(tolerance);
      expect(Math.abs(actualRois[i].height - expectedRois[i].height)).toBeLessThan(tolerance);
    }
  
    mockTensor.dispose();
  });
  

  it('should throw an error if the model is not loaded', async () => {
    const uninitializedDetector = new FaceDetectorAsync(1, 0.5, 0.3);
    const mockData = new Float32Array(224 * 224 * 3).fill(0);
    const mockTensor = tf.tensor4d(mockData, [1, 224, 224, 3]);
    const frame = new Frame(mockTensor, [0]);

    // Temporarily make `model` null to simulate uninitialized state
    (uninitializedDetector as any).model = null;

    await expect(uninitializedDetector.detect(frame)).rejects.toThrow(
      'Face detection model is not loaded.'
    );
    mockTensor.dispose();
  });
});
