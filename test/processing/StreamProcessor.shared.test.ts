import { StreamProcessor } from '../../src/processing/StreamProcessor';
import { BufferManager } from '../../src/processing/BufferManager';
import { MethodHandler } from '../../src/methods/MethodHandler';
import { IFaceDetector } from '../../src/types/IFaceDetector';
import { IFrameIterator } from '../../src/types/IFrameIterator';
import { ROI, VitalLensOptions, MethodConfig } from '../../src/types';
import { Frame } from '../../src/processing/Frame'; 
import * as tf from '@tensorflow/tfjs';

const mockROI: ROI = { x0: 0, y0: 0, x1: 100, y1: 100 };
const mockFrame3D = Frame.fromTensor(tf.tensor3d([1, 2, 3, 4], [2, 2, 1]), false, [0.1], [mockROI]);
const mockFrame4D = Frame.fromTensor(tf.tensor4d([1, 2, 3, 4], [1, 2, 2, 1]), false, [0.1], [mockROI]);
const options: VitalLensOptions = { method: 'vitallens', globalRoi: { x0: 0, y0: 0, x1: 100, y1: 100 }, overrideFpsTarget: 30 };
const methodConfig: MethodConfig = { method: 'vitallens', fpsTarget: 30, roiMethod: 'face', minWindowLength: 5, maxWindowLength: 10, requiresState: false };

describe('StreamProcessor', () => {
  let mockBufferManager: jest.Mocked<BufferManager>;
  let mockMethodHandler: jest.Mocked<MethodHandler>;
  let mockFaceDetector: jest.Mocked<IFaceDetector>;
  let mockFrameIterator: jest.Mocked<IFrameIterator>;
  let onPredictMock: jest.Mock;
  
  beforeEach(() => {
    mockBufferManager = {
      addBuffer: jest.fn(),
      add: jest.fn(),
      isReady: jest.fn(() => true),
      consume: jest.fn(async () => mockFrame4D),
      getState: jest.fn(() => new Float32Array([1.0, 2.0, 3.0])),
      setState: jest.fn(),
      resetState: jest.fn(),
      cleanup: jest.fn(),
    } as unknown as jest.Mocked<BufferManager>;
  
    mockMethodHandler = {
      process: jest.fn(async () => ({
        state: { data: new Float32Array([1, 2, 3]) },
      })), // Ensure it returns an object with a `state`
      getReady: jest.fn(() => true),
    } as unknown as jest.Mocked<MethodHandler>;
  
    mockFaceDetector = {
      run: jest.fn(async (frame, callback) => {
        const mockDetections = [{ x0: 0.1, y0: 0.2, x1: 0.6, y1: 0.7 }];
        await callback(mockDetections);
      }),
    } as unknown as jest.Mocked<IFaceDetector>;
  
    mockFrameIterator = {
      [Symbol.asyncIterator]: jest.fn(() => ({
        next: jest.fn(() => Promise.resolve({ value: mockFrame3D, done: false })),
      })),
      start: jest.fn(),
      stop: jest.fn(),
    } as unknown as jest.Mocked<IFrameIterator>;
  
    onPredictMock = jest.fn();
  });  

  test('should initialize with the correct ROI and buffer', () => {
    const streamProcessor = new StreamProcessor(
      options,
      methodConfig,
      mockFrameIterator,
      mockBufferManager,
      mockFaceDetector,
      mockMethodHandler,
      onPredictMock
    );

    streamProcessor.init();

    expect(mockBufferManager.addBuffer).toHaveBeenCalledWith(options.globalRoi, methodConfig, 1);
  });

  test('should start processing frames and trigger prediction', async () => {
    const options: VitalLensOptions = { method: 'vitallens', globalRoi: { x0: 0, y0: 0, x1: 100, y1: 100 }, overrideFpsTarget: 30 };
    const methodConfig: MethodConfig = { method: 'vitallens', fpsTarget: 30, roiMethod: 'face', minWindowLength: 5, maxWindowLength: 10, requiresState: false };
    const streamProcessor = new StreamProcessor(
      options,
      methodConfig,
      mockFrameIterator,
      mockBufferManager,
      mockFaceDetector,
      mockMethodHandler,
      onPredictMock
    );

    await streamProcessor.start();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockFrameIterator.start).toHaveBeenCalled();
    expect(mockBufferManager.add).toHaveBeenCalled();
    expect(mockMethodHandler.process).toHaveBeenCalled();
    expect(onPredictMock).toHaveBeenCalled();
  });

  test('should update ROI on face detection', async () => {
    const streamProcessor = new StreamProcessor(
      options,
      methodConfig,
      mockFrameIterator,
      mockBufferManager,
      mockFaceDetector,
      mockMethodHandler,
      onPredictMock
    );

    await streamProcessor['handleFaceDetection'](mockFrame3D as any, 0);

    expect(mockFaceDetector.run).toHaveBeenCalledWith(mockFrame3D, expect.any(Function));
    expect(mockBufferManager.addBuffer).toHaveBeenCalled();
  });

  test('should stop processing and clean up buffer', () => {
    const streamProcessor = new StreamProcessor(
      options,
      methodConfig,
      mockFrameIterator,
      mockBufferManager,
      mockFaceDetector,
      mockMethodHandler,
      onPredictMock
    );

    streamProcessor.stop();

    expect(mockFrameIterator.stop).toHaveBeenCalled();
    expect(mockBufferManager.cleanup).toHaveBeenCalled();
  });
});
