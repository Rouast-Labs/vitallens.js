/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { StreamProcessor } from '../../src/processing/StreamProcessor.browser';
import { Frame } from '../../src/processing/Frame';
import {
  checkFaceInROI,
  checkROIValid,
  getROIForMethod,
} from '../../src/utils/faceOps';
import { VitalLensOptions, MethodConfig, VideoInput } from '../../src/types';
import { BufferManager } from '../../src/processing/BufferManager';
import { IFaceDetectionWorker } from '../../src/types/IFaceDetectionWorker';

jest.mock('../../src/utils/faceOps', () => ({
  checkFaceInROI: jest.fn(),
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
  };

  // Dummy stubs for parameters not used in these tests.
  const dummyFrameIterator = {} as any;
  const dummyMethodHandler = {} as any;
  const dummyOnPredict = jest.fn(async (result) => {});
  const dummyOnNoFace = jest.fn(async () => {});

  // Minimal BufferManager mock.
  const fakeBufferManager: BufferManager = {
    addBuffer: jest.fn(),
    isReady: jest.fn(() => true),
    add: jest.fn(),
    consume: jest.fn(async () => null),
    cleanup: jest.fn(),
    isEmpty: jest.fn(() => true),
    setState: jest.fn(),
    resetState: jest.fn(),
    getState: jest.fn(() => new Float32Array([])),
  } as unknown as BufferManager;

  // Minimal face detection worker mock.
  const mockFaceDetectionWorker: jest.Mocked<IFaceDetectionWorker> = {
    postMessage: jest.fn(),
    terminate: jest.fn(),
    onmessage: null,
    onmessageerror: null,
    detectFaces: jest.fn(async (videoInput, type) => ({
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
      methodConfig,
      dummyFrameIterator,
      fakeBufferManager,
      mockFaceDetectionWorker,
      dummyMethodHandler,
      dummyOnPredict,
      dummyOnNoFace
    );
  });

  describe('triggerFaceDetection', () => {
    it('should throw an error if faceDetectionWorker is null', () => {
      const proc = new StreamProcessor(
        options,
        methodConfig,
        dummyFrameIterator,
        fakeBufferManager,
        null, // No face detection worker provided.
        dummyMethodHandler,
        dummyOnPredict,
        dummyOnNoFace
      );
      expect(() =>
        (proc as any).triggerFaceDetection(mockFrame as unknown as Frame, 1)
      ).toThrowError('Face detection worker does not exist.');
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
      (fakeBufferManager.cleanup as jest.Mock).mockClear();
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

    it('should update ROI when detections are present and update is needed', () => {
      // Ensure the processor is in a state that requires ROI update.
      (processor as any).options.method = 'vitallens';
      (processor as any).roi = null;
      const mockDetection = { x0: 10, y0: 20, x1: 50, y1: 60 };
      const updatedROI = { x0: 12, y0: 22, x1: 48, y1: 58 };
      // Configure the mocked functions.
      (checkFaceInROI as jest.Mock).mockReturnValue(false);
      (checkROIValid as jest.Mock).mockReturnValue(true);
      (getROIForMethod as jest.Mock).mockReturnValue(updatedROI);
      (fakeBufferManager.isEmpty as jest.Mock).mockReturnValue(true);

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
      // The processor's ROI should be updated.
      expect((processor as any).roi).toEqual(updatedROI);
      // Because fakeBufferManager.isEmpty() returns true (or for vitallens), a new buffer is added.
      expect(fakeBufferManager.addBuffer).toHaveBeenCalledWith(
        updatedROI,
        methodConfig,
        2.5
      );
    });

    it('should not update ROI if checkFaceInROI indicates the face is already within the ROI', () => {
      const currentROI = { x0: 10, y0: 20, x1: 50, y1: 60 };
      (processor as any).options.method = 'vitallens';
      (processor as any).roi = currentROI;
      // Simulate that the detected face is already inside the current ROI.
      (checkFaceInROI as jest.Mock).mockReturnValue(true);
      (checkROIValid as jest.Mock).mockReturnValue(true);
      (fakeBufferManager.addBuffer as jest.Mock).mockClear();

      const eventWithDetections = new MessageEvent('message', {
        data: {
          id: 3,
          detections: [{ x0: 11, y0: 21, x1: 49, y1: 59 }],
          width: 640,
          height: 480,
          timestamp: 3.0,
        },
      });
      (processor as any).handleFaceDetectionResult(eventWithDetections);

      // The ROI should remain unchanged.
      expect((processor as any).roi).toEqual(currentROI);
      // No new buffer should be added.
      expect(fakeBufferManager.addBuffer).not.toHaveBeenCalled();
    });
  });
});
