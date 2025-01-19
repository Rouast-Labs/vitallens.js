import { RGBBuffer } from '../../src/processing/RGBBuffer';
import { Frame } from '../../src/processing/Frame';
import { ROI } from '../../src/types/core';
import * as tf from '@tensorflow/tfjs';
import { MethodConfig } from '../../src/config/methodsConfig';

const mockROI: ROI = { x: 10, y: 10, width: 20, height: 20 };
const mockMethodConfig: MethodConfig = { method: 'pos', inputSize: 40, fpsTarget: 30, roiMethod: 'face', minWindowLength: 5, maxWindowLength: 10, windowOverlap: 2, requiresState: false };

describe('RGBBuffer', () => {
  
  afterEach(() => {
    jest.clearAllMocks();
    tf.disposeVariables();
  });

  it('should preprocess a valid frame with correct ROI', async () => {
    const mockTensor = tf.tensor3d(new Array(100 * 100 * 3).fill(1), [100, 100, 3]);
    const frame = new Frame(mockTensor, [12345]);

    const rgbBuffer = new RGBBuffer(mockROI, mockMethodConfig);
    const result = await rgbBuffer["preprocess"](frame, mockROI);

    expect(result).toBeInstanceOf(Frame);
    expect(result.timestamp).toBe(frame.timestamp);

    // Check the processed tensor dimensions
    const resultTensor = result.data as tf.Tensor1D;
    expect(resultTensor.shape).toEqual([3]);
    
    // Check tensor disposal
    result.data.dispose();
    expect(tf.memory().numTensors).toBe(0);
  });

  it('should throw an error if frame data is not a 3D tensor', async () => {
    const invalidTensor = tf.tensor2d(new Array(100 * 100).fill(1), [100, 100]);
    const frame = new Frame(invalidTensor, [12345]);

    const rgbBuffer = new RGBBuffer(mockROI, mockMethodConfig);

    await expect(rgbBuffer["preprocess"](frame, mockROI)).rejects.toThrow('Frame data must be a 3D tensor.');
    
    expect(tf.memory().numTensors).toBe(0);
  });

  it('should throw an error if ROI dimensions are out of bounds', async () => {
    const mockTensor = tf.tensor3d(new Array(100 * 100 * 3).fill(1), [100, 100, 3]);
    const frame = new Frame(mockTensor, [12345]);
    const invalidROI: ROI = { x: 90, y: 90, width: 20, height: 20 };

    const rgbBuffer = new RGBBuffer(mockROI, mockMethodConfig);

    await expect(rgbBuffer["preprocess"](frame, invalidROI)).rejects.toThrow('ROI dimensions are out of bounds.');
    expect(tf.memory().numTensors).toBe(0);
  });

  it('should handle frames with boundary ROIs correctly', async () => {
    const mockTensor = tf.tensor3d(new Array(100 * 100 * 3).fill(1), [100, 100, 3]);
    const frame = new Frame(mockTensor, [12345]);
    const boundaryROI: ROI = { x: 0, y: 0, width: 100, height: 100 };

    const rgbBuffer = new RGBBuffer(mockROI, mockMethodConfig);
    const result = await rgbBuffer["preprocess"](frame, boundaryROI);

    expect(result).toBeInstanceOf(Frame);
    expect(result.timestamp).toBe(frame.timestamp);
    result.data.dispose();
  });
});
