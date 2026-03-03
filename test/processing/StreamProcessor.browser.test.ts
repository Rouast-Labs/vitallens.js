/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { StreamProcessor } from '../../src/processing/StreamProcessor.browser';
import { Frame } from '../../src/processing/Frame';
import {
  checkROIValid,
  getROIForMethod,
} from '../../src/utils/faceOps';
import { VitalLensOptions, MethodConfig } from '../../src/types';
import { BufferManager } from '../../src/processing/BufferManager';
import { IFaceDetectionWorker } from '../../src/types/IFaceDetectionWorker';

jest.mock('../../src/utils/faceOps', () => ({
  getROIForMethod: jest.fn(),
  checkROIValid: jest.fn(),
}));

describe('StreamProcessor (Browser)', () => {
  // Dummy options and method config.
  const options: VitalLensOptions = {
    method: 'vitallens',
    globalRoi: { x0: 0, y0: 0, x1: 100, y1: 100 },
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

  // Dummy stubs for parameters not used in these tests.
  const dummyFrameIterator = {} as any;
  const dummyMethodHandler = {} as any;
  const dummyBufferedResultsConsumer = {} as any;
  const dummyOnPredict = jest.fn(async (result) => {});
  const dummyOnNoFace = jest.fn(async () => {});
  const dummyOnStreamReset = jest.fn();
  const dummyOnFaceDetected = jest.fn();

  // Minimal BufferManager mock aligned with new processTarget API.
  const fakeBufferManager = {
    processTarget: jest.fn(),
    poll: jest.fn(),
    consumeCommand: jest.fn(),
    add: jest.fn(),
    cleanup: jest.fn(),
    isEmpty: jest.fn(() => true),
    setState: jest.fn(),
    resetState: jest.fn(),
    getState: jest.fn(() => new Float32Array([])),
  } as unknown as jest.Mocked<BufferManager>;

  // Minimal face detection worker mock.
  const mockFaceDetectionWorker: jest.Mocked<IFaceDetectionWorker> = {
    postMessage: jest.fn(),
    terminate: jest.fn(),
    onmessage: null,
    onmessageerror: null,
    detectFaces: jest.fn(async () => ({
      detections: [],
      probeInfo: {
        totalFrames: 0,
        fps: 0,
        width: 0,
        height: 0,
        codec: '',
        bitrate: 0,
        rotation: 0,
        issues: false,
      },
    })),
  };

  // Dummy frame with minimal methods.
  const dummyTransferable = {
    rawData: new ArrayBuffer(8),
    shape: [1, 1, 1],
    dtype: 'uint8',
    timestamp: [0.5],
    roi: [{ x0: 0, y0: 0, x1: 1, y1: 1 }],
  };
  const mockFrame = {
    toTransferable: jest.fn(() => dummyTransferable),
    release: jest.fn(),
  };

  // The processor instance under test.
  let processor: StreamProcessor;

  beforeEach(() => {
    // Create a new instance of StreamProcessor with the dummy dependencies.
    processor = new StreamProcessor(
      options,
      () => methodConfig,
      dummyFrameIterator,
      fakeBufferManager,
      mockFaceDetectionWorker,
      dummyMethodHandler,
      dummyBufferedResultsConsumer,
      dummyOnPredict,
      dummyOnNoFace,
      dummyOnStreamReset,
      dummyOnFaceDetected
    );
  });

  describe('triggerFaceDetection', () => {
    it('should throw an error if faceDetectionWorker is null', () => {
      const proc = new StreamProcessor(
        options,
        () => methodConfig,
        dummyFrameIterator,
        fakeBufferManager,
        null, // No face detection worker provided.
        dummyMethodHandler,
        dummyBufferedResultsConsumer,
        dummyOnPredict,
        dummyOnNoFace,
        dummyOnStreamReset,
        dummyOnFaceDetected
      );
      expect(() =>
        (proc as any).triggerFaceDetection(mockFrame as unknown as Frame, 1)
      ).toThrow('Face detection worker does not exist.');
    });

    it('should send postMessage with correct data and release the frame', () => {
      const currentTime = 1.23;
      (processor as any).triggerFaceDetection(
        mockFrame as unknown as Frame,
        currentTime
      );

      // Ensure the frame's transferable data is retrieved.
      expect(mockFrame.toTransferable).toHaveBeenCalled();

      // Verify that the worker’s postMessage is called once with the correct payload.
      expect(mockFaceDetectionWorker.postMessage).toHaveBeenCalledTimes(1);
      const [message, transferables] =
        mockFaceDetectionWorker.postMessage.mock.calls[0];
      expect(message).toMatchObject({
        id: 0,
        data: dummyTransferable,
        dataType: 'frame',
        fs: 1,
        timestamp: currentTime,
      });
      // The transferables array should include the rawData.
      expect(transferables).toEqual([dummyTransferable.rawData]);

      // The frame should be released immediately.
      expect(mockFrame.release).toHaveBeenCalled();
    });

    it('should increment the request id on subsequent calls', () => {
      jest.clearAllMocks();
      (processor as any).triggerFaceDetection(mockFrame as unknown as Frame, 1);
      (processor as any).triggerFaceDetection(mockFrame as unknown as Frame, 2);
      const firstCall = (mockFaceDetectionWorker.postMessage as jest.Mock).mock
        .calls[0][0];
      const secondCall = (mockFaceDetectionWorker.postMessage as jest.Mock).mock
        .calls[1][0];
      expect(firstCall.id).toBe(0);
      expect(secondCall.id).toBe(1);
    });
  });

  describe('handleFaceDetectionResult', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should log an error if event.data.error is present', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const errorEvent = new MessageEvent('message', {
        data: { id: 0, error: 'Test error' },
      });
      (processor as any).handleFaceDetectionResult(errorEvent);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Face detection error (id: 0):',
        'Test error'
      );
      consoleErrorSpy.mockRestore();
    });

    it('should clean up and trigger onNoFace when no detections are present', () => {
      fakeBufferManager.cleanup.mockClear();
      dummyOnNoFace.mockClear();

      const eventNoDetections = new MessageEvent('message', {
        data: {
          id: 1,
          detections: [],
          width: 640,
          height: 480,
          timestamp: 1.0,
        },
      });
      (processor as any).handleFaceDetectionResult(eventNoDetections);

      // The ROI should be reset to null.
      expect((processor as any).roi).toBeNull();
      // The buffer manager cleanup should be invoked.
      expect(fakeBufferManager.cleanup).toHaveBeenCalled();
      // And the onNoFace callback should be triggered.
      expect(dummyOnNoFace).toHaveBeenCalled();
    });

    it('should set pendingRoi when processTarget returns an active ROI', () => {
      const mockDetection = { x0: 10, y0: 20, x1: 50, y1: 60 };
      const calculatedROI = { x0: 12, y0: 22, x1: 48, y1: 58 };
      
      (checkROIValid as jest.Mock).mockReturnValue(true);
      (getROIForMethod as jest.Mock).mockReturnValue(calculatedROI);
      (fakeBufferManager.processTarget as jest.Mock).mockReturnValue(calculatedROI);

      const probeInfo = { width: 640, height: 480 };
      const eventWithDetections = new MessageEvent('message', {
        data: {
          id: 2,
          detections: [mockDetection],
          probeInfo: probeInfo,
          timestamp: 2.5,
        },
      });
      
      (processor as any).handleFaceDetectionResult(eventWithDetections);

      // Expect getROIForMethod to be called with the detection and image dimensions.
      expect(getROIForMethod).toHaveBeenCalledWith(
        mockDetection,
        methodConfig,
        probeInfo,
        true
      );
      // Expect processTarget to be called
      expect(fakeBufferManager.processTarget).toHaveBeenCalledWith(
        calculatedROI,
        2.5,
        methodConfig
      );
      // The processor's pending ROI should be updated.
      expect((processor as any).pendingRoi).toEqual(calculatedROI);
    });

    it('should not update pendingRoi when processTarget returns null', () => {
      const mockDetection = { x0: 10, y0: 20, x1: 50, y1: 60 };
      const calculatedROI = { x0: 12, y0: 22, x1: 48, y1: 58 };

      (checkROIValid as jest.Mock).mockReturnValue(true);
      (getROIForMethod as jest.Mock).mockReturnValue(calculatedROI);
      
      // Simulate Planner returning null (e.g. "Ignore" action)
      (fakeBufferManager.processTarget as jest.Mock).mockReturnValue(null);

      // Reset pendingRoi to ensure it stays null
      (processor as any).pendingRoi = null;

      const eventWithDetections = new MessageEvent('message', {
        data: {
          id: 3,
          detections: [mockDetection],
          probeInfo: { width: 640, height: 480 },
          timestamp: 3.0,
        },
      });
      (processor as any).handleFaceDetectionResult(eventWithDetections);

      expect(fakeBufferManager.processTarget).toHaveBeenCalled();
      expect((processor as any).pendingRoi).toBeNull();
    });
  });

  describe('onFaceDetected', () => {
    it('should call onFaceDetected callback on valid detection', () => {
      const event = new MessageEvent('message', {
        data: {
          id: 1,
          detections: [{ x0: 10, y0: 10, x1: 50, y1: 50, confidence: 0.99 }],
          probeInfo: { width: 640, height: 480 },
          timestamp: 1.0,
        },
      });

      (processor as any).handleFaceDetectionResult(event);

      expect(dummyOnFaceDetected).toHaveBeenCalledWith({
        coordinates: [10, 10, 50, 50],
        confidence: 0.99,
      });
    });
  });
});