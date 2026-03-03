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
import { BufferedResultsConsumer } from '../../src/processing/BufferedResultsConsumer';

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
        timestamp: currentTime,
      },
    });
    this.handleFaceDetectionResult(fakeEvent);
    // In this simple test implementation, release the frame.
    frame.release();
  }

  handleFaceDetectionResult(event: MessageEvent): void {
    const data = event.data;
    // Manually trigger the public callback if it exists and we have detections
    if (
      this.onFaceDetected &&
      data &&
      data.detections &&
      data.detections.length > 0
    ) {
      const det = data.detections[0];
      this.onFaceDetected({
        coordinates: [det.x0, det.y0, det.x1, det.y1],
        confidence: det.confidence ?? 1.0,
      });
    }
    if (data && data.detections && data.detections.length > 0) {
      // Simulate the exact logic in StreamProcessor.browser.ts
      const detection = data.detections[0];
      const activeRoi = this.bufferManager.processTarget(detection, data.timestamp, this.methodConfig);
      if (activeRoi) {
        this.pendingRoi = activeRoi;
      }
    } else {
      // If no detections, trigger onNoFace and clean up.
      this.roi = null;
      this.pendingRoi = null;
      this.bufferManager.cleanup();
      this.onNoFace();
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
  bufferOffset: 1,
  supportedVitals: ['heart_rate', 'ppg_waveform'],
};
let onFaceDetectedMock: jest.Mock;

describe('StreamProcessor', () => {
  let mockBufferManager: jest.Mocked<BufferManager>;
  let mockMethodHandler: jest.Mocked<MethodHandler>;
  let mockFrameIterator: jest.Mocked<IFrameIterator>;
  let mockBufferedResultsConsumer: jest.Mocked<BufferedResultsConsumer>;
  let onPredictMock: jest.Mock;
  let onNoFaceMock: jest.Mock;
  let onStreamResetMock: jest.Mock;

  beforeEach(() => {
    // Create a mock BufferManager matching the new API
    mockBufferManager = {
      processTarget: jest.fn(() => mockROI),
      poll: jest.fn(() => ({ buffer_id: 'fake-id', take_count: 5, keep_count: 2 })),
      consumeCommand: jest.fn(async () => mockFrame4D),
      add: jest.fn(),
      getState: jest.fn(() => new Float32Array([1.0, 2.0, 3.0])),
      setState: jest.fn(),
      resetState: jest.fn(),
      cleanup: jest.fn(),
      isEmpty: jest.fn(() => false),
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

    // Create a mock BufferedResultsConsumer
    mockBufferedResultsConsumer = {
      addResults: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    } as unknown as jest.Mocked<BufferedResultsConsumer>;

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
    onStreamResetMock = jest.fn(async () => {});
    onFaceDetectedMock = jest.fn();
  });

  test('should initialize with the correct global ROI', () => {
    const processor = new TestStreamProcessor(
      options,
      () => methodConfig,
      mockFrameIterator,
      mockBufferManager,
      null,
      mockMethodHandler,
      null,
      onPredictMock,
      onNoFaceMock,
      onStreamResetMock,
      onFaceDetectedMock
    );

    processor.init();

    // When a global ROI is provided and face detector is not used, the ROI should be set to global ROI.
    expect((processor as any).roi).toEqual(options.globalRoi);
  });

  test('should start processing frames and trigger prediction via poll', async () => {
    const processor = new TestStreamProcessor(
      options,
      () => methodConfig,
      mockFrameIterator,
      mockBufferManager,
      null, // No face detection worker provided.
      mockMethodHandler,
      mockBufferedResultsConsumer,
      onPredictMock,
      onNoFaceMock,
      onStreamResetMock,
      onFaceDetectedMock
    );

    // Start processing; this calls frameIterator.start() and kicks off the async loop.
    await processor.start();

    // Allow some time for the processing loop to run.
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockFrameIterator.start).toHaveBeenCalled();
    
    // In the loop, since options.globalRoi is set, it will call processTarget to keep it alive
    expect(mockBufferManager.processTarget).toHaveBeenCalledWith(
      options.globalRoi,
      expect.any(Number),
      methodConfig
    );

    // Expect that for each yielded frame the BufferManager.add method was invoked.
    expect(mockBufferManager.add).toHaveBeenCalled();
    
    // It should have polled for a command and consumed it
    expect(mockBufferManager.poll).toHaveBeenCalledWith(expect.any(Number), 'Stream');
    expect(mockBufferManager.consumeCommand).toHaveBeenCalledWith(
      expect.objectContaining({ buffer_id: 'fake-id' })
    );

    // Expect that method handler process() is invoked.
    expect(mockMethodHandler.process).toHaveBeenCalled();
    // Expect buffered results consumer to have been started
    expect(mockBufferedResultsConsumer.start).toHaveBeenCalled();
    // And eventually the onPredict callback should be invoked.
    expect(onPredictMock).toHaveBeenCalled();
  });

  test('should call onStreamReset on a reset error', async () => {
    // Simulate an error that contains the "Resetting stream" message.
    mockMethodHandler.process.mockRejectedValue(
      new Error('Resetting stream now!')
    );

    const processor = new TestStreamProcessor(
      options,
      () => methodConfig,
      mockFrameIterator,
      mockBufferManager,
      null,
      mockMethodHandler,
      mockBufferedResultsConsumer,
      onPredictMock,
      onNoFaceMock,
      onStreamResetMock,
      onFaceDetectedMock
    );

    await processor.start();
    await new Promise((resolve) => setTimeout(resolve, 100)); // Allow async loop to run

    expect(onStreamResetMock).toHaveBeenCalled();
    expect(onNoFaceMock).not.toHaveBeenCalled(); // Ensure the wrong callback wasn't called
  });

  test('should update ROI on face detection using processTarget', async () => {
    const processor = new TestStreamProcessor(
      options,
      () => methodConfig,
      mockFrameIterator,
      mockBufferManager,
      {} as any, // dummy face detection worker (not used since we override triggerFaceDetection)
      mockMethodHandler,
      mockBufferedResultsConsumer,
      onPredictMock,
      onNoFaceMock,
      onStreamResetMock,
      onFaceDetectedMock
    );

    // Call triggerFaceDetection with a frame and mock timestamp
    processor.triggerFaceDetection(mockFrame3D, 12345);

    // Expect that BufferManager.processTarget is called with the detected ROI.
    expect(mockBufferManager.processTarget).toHaveBeenCalledWith(
      { x0: 10, y0: 10, x1: 50, y1: 50 },
      12345,
      methodConfig
    );
  });

  test('should trigger onNoFace callback when no face is detected', async () => {
    const processor = new TestStreamProcessor(
      options,
      () => methodConfig,
      mockFrameIterator,
      mockBufferManager,
      {} as any,
      mockMethodHandler,
      mockBufferedResultsConsumer,
      onPredictMock,
      onNoFaceMock,
      onStreamResetMock,
      onFaceDetectedMock
    );

    // Simulate a face detection event with no detections.
    const fakeEvent = new MessageEvent('message', {
      data: { detections: [], timestamp: 12345 },
    });
    processor.handleFaceDetectionResult(fakeEvent);

    expect(onNoFaceMock).toHaveBeenCalled();
    expect(mockBufferManager.cleanup).toHaveBeenCalled();
  });

  test('should stop processing and clean up buffer', () => {
    const processor = new TestStreamProcessor(
      options,
      () => methodConfig,
      mockFrameIterator,
      mockBufferManager,
      {} as any,
      mockMethodHandler,
      mockBufferedResultsConsumer,
      onPredictMock,
      onNoFaceMock,
      onStreamResetMock,
      onFaceDetectedMock
    );

    processor.stop();

    expect(mockFrameIterator.stop).toHaveBeenCalled();
    expect(mockBufferedResultsConsumer.stop).toHaveBeenCalled();
    expect(mockMethodHandler.cleanup).toHaveBeenCalled();
    expect(mockBufferManager.cleanup).toHaveBeenCalled();
  });

  test('should trigger onFaceDetected when face is found', async () => {
    const processor = new TestStreamProcessor(
      options,
      () => methodConfig,
      mockFrameIterator,
      mockBufferManager,
      null,
      mockMethodHandler,
      mockBufferedResultsConsumer,
      onPredictMock,
      onNoFaceMock,
      onStreamResetMock,
      onFaceDetectedMock
    );

    const fakeEvent = new MessageEvent('message', {
      data: {
        detections: [{ x0: 10, y0: 10, x1: 50, y1: 50, confidence: 0.95 }],
        timestamp: 12345,
      },
    });

    // Access private/protected method for testing
    (processor as any).handleFaceDetectionResult(fakeEvent);

    expect(onFaceDetectedMock).toHaveBeenCalledWith({
      coordinates: [10, 10, 50, 50],
      confidence: 0.95,
    });
  });
});