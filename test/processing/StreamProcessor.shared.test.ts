/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { StreamProcessorBase } from '../../src/processing/StreamProcessor.base';
import { BufferManager } from '../../src/processing/BufferManager';
import { MethodHandler } from '../../src/methods/MethodHandler';
import { IFrameIterator } from '../../src/types/IFrameIterator';
import {
  ROI,
  VitalLensOptions,
  MethodConfig,
  VitalLensResult,
} from '../../src/types';
import { Frame } from '../../src/processing/Frame';
import * as tf from '@tensorflow/tfjs-core';

class TestStreamProcessor extends StreamProcessorBase {
  triggerFaceDetection(frame: Frame, currentTime: number): void {
    // For testing, simulate a detection event with a non-empty result.
    const fakeEvent = new MessageEvent('message', {
      data: {
        detections: [{ x0: 10, y0: 10, x1: 50, y1: 50 }],
        probeInfo: {
          totalFrames: 100,
          fps: 30,
          width: 640,
          height: 480,
          codec: 'h264',
          bitrate: 1000,
          rotation: 0,
          issues: false,
        },
      },
    });
    this.handleFaceDetectionResult(fakeEvent);
    // In this simple test implementation, release the frame.
    frame.release();
  }

  handleFaceDetectionResult(event: MessageEvent): void {
    const data = event.data;
    if (data && data.detections && data.detections.length > 0) {
      // Update ROI to the first detection.
      const detection = data.detections[0];
      this.roi = detection;
      // Simulate adding a new buffer for the updated ROI.
      this.bufferManager.addBuffer(detection, this.methodConfig, 1);
    } else {
      // If no detections, trigger onNoFace and clean up.
      this.onNoFace();
      this.bufferManager.cleanup();
    }
  }
}

const mockROI: ROI = { x0: 0, y0: 0, x1: 100, y1: 100 };
const mockFrame3D = Frame.fromTensor(
  tf.tensor3d([1, 2, 3, 4], [2, 2, 1]),
  false,
  [0.1],
  [mockROI]
);
const mockFrame4D = Frame.fromTensor(
  tf.tensor4d([1, 2, 3, 4], [1, 2, 2, 1]),
  false,
  [0.1],
  [mockROI]
);
const options: VitalLensOptions = {
  method: 'vitallens',
  globalRoi: mockROI,
  overrideFpsTarget: 30,
};
const methodConfig: MethodConfig = {
  method: 'vitallens',
  fpsTarget: 30,
  roiMethod: 'face',
  minWindowLength: 5,
  maxWindowLength: 10,
  requiresState: false,
};

describe('StreamProcessor', () => {
  let mockBufferManager: jest.Mocked<BufferManager>;
  let mockMethodHandler: jest.Mocked<MethodHandler>;
  let mockFrameIterator: jest.Mocked<IFrameIterator>;
  let onPredictMock: jest.Mock;
  let onNoFaceMock: jest.Mock;

  beforeEach(() => {
    // Create a mock BufferManager with the necessary methods.
    mockBufferManager = {
      addBuffer: jest.fn(),
      add: jest.fn(),
      isReady: jest.fn(() => true),
      consume: jest.fn(async () => mockFrame4D),
      getState: jest.fn(() => new Float32Array([1.0, 2.0, 3.0])),
      setState: jest.fn(),
      resetState: jest.fn(),
      cleanup: jest.fn(),
      isEmpty: jest.fn(() => true),
    } as unknown as jest.Mocked<BufferManager>;

    // Create a mock MethodHandler that returns a fake state.
    mockMethodHandler = {
      process: jest.fn(async () => ({
        state: { data: new Float32Array([1, 2, 3]) },
      })),
      getReady: jest.fn(() => true),
      init: jest.fn(),
      cleanup: jest.fn(),
    } as unknown as jest.Mocked<MethodHandler>;

    // Create a mock FrameIterator that yields frames indefinitely.
    mockFrameIterator = {
      [Symbol.asyncIterator]: jest.fn(() => {
        let count = 0;
        return {
          next: jest.fn(() => {
            count++;
            // After a couple of frames, stop the iteration.
            if (count > 2) {
              return Promise.resolve({ value: undefined, done: true });
            }
            return Promise.resolve({ value: mockFrame3D, done: false });
          }),
        };
      }),
      start: jest.fn(),
      stop: jest.fn(),
    } as unknown as jest.Mocked<IFrameIterator>;

    onPredictMock = jest.fn(async (result: VitalLensResult) => {});
    onNoFaceMock = jest.fn(async () => {});
  });

  test('should initialize with the correct ROI and buffer', () => {
    const processor = new TestStreamProcessor(
      options,
      methodConfig,
      mockFrameIterator,
      mockBufferManager,
      null,
      mockMethodHandler,
      onPredictMock,
      onNoFaceMock
    );

    processor.init();

    // When a global ROI is provided and face detector is not used, the ROI should be set and a buffer added.
    expect(mockBufferManager.addBuffer).toHaveBeenCalledWith(
      options.globalRoi,
      methodConfig,
      1
    );
  });

  test('should start processing frames and trigger prediction', async () => {
    const processor = new TestStreamProcessor(
      options,
      methodConfig,
      mockFrameIterator,
      mockBufferManager,
      null, // No face detection worker provided.
      mockMethodHandler,
      onPredictMock,
      onNoFaceMock
    );

    // Start processing; this calls frameIterator.start() and kicks off the async loop.
    await processor.start();

    // Allow some time for the processing loop to run.
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockFrameIterator.start).toHaveBeenCalled();
    // Expect that for each yielded frame the BufferManager.add method was invoked.
    expect(mockBufferManager.add).toHaveBeenCalled();
    // Expect that when buffers are ready and the method handler is ready, process() is invoked.
    expect(mockMethodHandler.process).toHaveBeenCalled();
    // And eventually the onPredict callback should be invoked.
    expect(onPredictMock).toHaveBeenCalled();
  });

  test('should update ROI on face detection', async () => {
    const processor = new TestStreamProcessor(
      options,
      methodConfig,
      mockFrameIterator,
      mockBufferManager,
      {} as any, // dummy face detection worker (not used since we override triggerFaceDetection)
      mockMethodHandler,
      onPredictMock,
      onNoFaceMock
    );

    // Call triggerFaceDetection with a frame.
    processor.triggerFaceDetection(mockFrame3D, 0);

    // Expect that BufferManager.addBuffer is called with the detected ROI.
    expect(mockBufferManager.addBuffer).toHaveBeenCalledWith(
      { x0: 10, y0: 10, x1: 50, y1: 50 },
      methodConfig,
      1
    );
  });

  test('should trigger onNoFace callback when no face is detected', async () => {
    const processor = new TestStreamProcessor(
      options,
      methodConfig,
      mockFrameIterator,
      mockBufferManager,
      {} as any,
      mockMethodHandler,
      onPredictMock,
      onNoFaceMock
    );

    // Simulate a face detection event with no detections.
    const fakeEvent = new MessageEvent('message', {
      data: { detections: [] },
    });
    processor.handleFaceDetectionResult(fakeEvent);

    expect(onNoFaceMock).toHaveBeenCalled();
    expect(mockBufferManager.cleanup).toHaveBeenCalled();
  });

  test('should stop processing and clean up buffer', () => {
    const processor = new TestStreamProcessor(
      options,
      methodConfig,
      mockFrameIterator,
      mockBufferManager,
      {} as any,
      mockMethodHandler,
      onPredictMock,
      onNoFaceMock
    );

    processor.stop();

    expect(mockFrameIterator.stop).toHaveBeenCalled();
    expect(mockMethodHandler.cleanup).toHaveBeenCalled();
    expect(mockBufferManager.cleanup).toHaveBeenCalled();
  });
});
