/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { VitalLensControllerBase } from '../../src/core/VitalLensController.base';
import { BufferManager } from '../../src/processing/BufferManager';
import { MethodHandlerFactory } from '../../src/methods/MethodHandlerFactory';
import { VitalsEstimateManager } from '../../src/processing/VitalsEstimateManager';
import {
  MethodConfig,
  VitalLensOptions,
  VitalLensResult,
} from '../../src/types/core';
import { IRestClient } from '../../src/types/IRestClient';
import { IFFmpegWrapper } from '../../src/types/IFFmpegWrapper';
import { IFaceDetectionWorker } from '../../src/types/IFaceDetectionWorker';
import { IFrameIterator } from '../../src/types/IFrameIterator';
import { MethodHandler } from '../../src/methods/MethodHandler';
import { IStreamProcessor } from '../../src/types/IStreamProcessor';
import { FrameIteratorFactory } from '../../src/processing/FrameIteratorFactory';
import { BufferedResultsConsumer } from '../../src/processing/BufferedResultsConsumer';
import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/core/wasmProvider', () => {
  return {
    getCore: vi.fn().mockResolvedValue({
      calculateRoi: vi
        .fn()
        .mockReturnValue({ x: 0, y: 0, width: 100, height: 100 }),
      computeBufferConfig: vi.fn().mockReturnValue({}),
      BufferPlanner: vi.fn().mockImplementation(() => ({
        evaluateTarget: vi.fn(),
        poll: vi.fn(),
      })),
      Session: vi.fn().mockImplementation(() => ({
        processJs: vi.fn(),
        reset: vi.fn(),
      })),
    })
  };
});
vi.mock('../../src/processing/BufferManager');
vi.mock('../../src/processing/FrameIteratorFactory');
vi.mock('../../src/methods/MethodHandler');
vi.mock('../../src/methods/MethodHandlerFactory');
vi.mock('../../src/processing/VitalsEstimateManager');

class TestVitalLensController extends VitalLensControllerBase {
  protected createRestClient(apiKey: string, proxyUrl?: string): IRestClient {
    return {
      sendFrames: vi.fn(),
      resolveModel: vi.fn(),
    };
  }
  protected createFFmpegWrapper(): IFFmpegWrapper {
    return {
      init: vi.fn(),
      loadInput: vi.fn(),
      cleanup: vi.fn(),
      probeVideo: vi.fn(),
      readVideo: vi.fn(),
    };
  }
  protected createFaceDetectionWorker(): IFaceDetectionWorker {
    return {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: vi.fn(),
      onmessageerror: vi.fn(),
      onerror: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      detectFaces: vi.fn(),
    };
  }
  protected createStreamProcessor(
    options: VitalLensOptions,
    getConfig: () => MethodConfig,
    frameIterator: IFrameIterator,
    bufferManager: BufferManager,
    faceDetectionWorker: IFaceDetectionWorker | null,
    methodHandler: MethodHandler,
    bufferedResultsConsumer: BufferedResultsConsumer | null,
    onPredict: (result: VitalLensResult) => Promise<void>,
    onNoFace: () => Promise<void>,
    onStreamReset: () => Promise<void>,
    onFaceDetected?: (face: any) => void
  ): IStreamProcessor {
    return {
      init: vi.fn(),
      start: vi.fn(),
      isProcessing: vi.fn(),
      stop: vi.fn(),
      setInferenceEnabled: vi.fn(),
      reset: vi.fn(),
    };
  }
}

describe('VitalLensControllerBase', () => {
  let controller: TestVitalLensController;
  const mockOptions: VitalLensOptions = {
    apiKey: 'test-key',
    method: 'vitallens',
    requestMode: 'rest',
  };
  let mockStreamProcessor: Partial<IStreamProcessor>;

  beforeEach(() => {
    (MethodHandlerFactory.createHandler as vi.Mock).mockReturnValue({
      init: vi.fn(),
      cleanup: vi.fn(),
      getReady: vi.fn().mockReturnValue(true),
      process: vi.fn(),
    });
    controller = new TestVitalLensController(mockOptions);
    controller['streamProcessor'] = null;
  });

  describe('constructor', () => {
    test('should initialize components', () => {
      expect(BufferManager).toHaveBeenCalled();
      expect(FrameIteratorFactory).toHaveBeenCalled();
      expect(VitalsEstimateManager).toHaveBeenCalledWith(
        expect.any(Function),
        mockOptions
      );
      expect(MethodHandlerFactory.createHandler).toHaveBeenCalledWith(
        mockOptions,
        expect.any(Object)
      );
    });
    test('should create faceDetectionWorker if globalRoi is undefined', () => {
      expect(controller['faceDetectionWorker']).toBeDefined();
    });
    test('should not create faceDetectionWorker when globalRoi is provided', () => {
      const optionsWithGlobalRoi: VitalLensOptions = {
        ...mockOptions,
        globalRoi: { x0: 0, y0: 0, x1: 100, y1: 100 },
      };
      const controllerWithRoi = new TestVitalLensController(
        optionsWithGlobalRoi
      );
      expect(controllerWithRoi['faceDetectionWorker']).toBeNull();
    });
  });

  describe('createMethodHandler', () => {
    test('should create a MethodHandler with correct dependencies (REST)', () => {
      const optionsWithRest: VitalLensOptions = {
        apiKey: 'test-key',
        method: 'vitallens',
        requestMode: 'rest',
      };
      const methodHandlerWithRest =
        controller['createMethodHandler'](optionsWithRest);
      expect(MethodHandlerFactory.createHandler).toHaveBeenCalledWith(
        optionsWithRest,
        {
          restClient: expect.any(Object),
        }
      );
      expect(methodHandlerWithRest).toBeDefined();
    });

    test('should throw an error if method is vitallens and apiKey is missing', () => {
      const optionsWithoutApiKey: VitalLensOptions = {
        method: 'vitallens',
        requestMode: 'rest',
      };
      expect(() =>
        controller['createMethodHandler'](optionsWithoutApiKey)
      ).toThrow(/A valid API key or proxy URL is required/);
    });

    test('should create a MethodHandler without requiring an apiKey for non-vitallens methods', () => {
      const optionsForOtherMethod: VitalLensOptions = { method: 'pos' };
      const methodHandler = controller['createMethodHandler'](
        optionsForOtherMethod
      );
      expect(MethodHandlerFactory.createHandler).toHaveBeenCalledWith(
        optionsForOtherMethod,
        {
          restClient: undefined,
        }
      );
      expect(methodHandler).toBeDefined();
    });
  });

  describe('startVideoStream', () => {
    test('should start the video stream if not already processing', () => {
      mockStreamProcessor = {
        isProcessing: vi.fn().mockReturnValue(false),
        start: vi.fn(),
        setInferenceEnabled: vi.fn(),
        reset: vi.fn(),
        stop: vi.fn(),
        init: vi.fn(),
      };
      controller['streamProcessor'] = mockStreamProcessor as IStreamProcessor;

      controller.startVideoStream();
      expect(mockStreamProcessor.start).toHaveBeenCalled();
    });

    test('should not start the video stream if already processing', () => {
      mockStreamProcessor = {
        isProcessing: vi.fn().mockReturnValue(true),
        start: vi.fn(),
        setInferenceEnabled: vi.fn(),
        reset: vi.fn(),
        stop: vi.fn(),
        init: vi.fn(),
      };
      controller['streamProcessor'] = mockStreamProcessor as IStreamProcessor;

      controller.startVideoStream();
      expect(mockStreamProcessor.start).not.toHaveBeenCalled();
    });
  });

  describe('pauseVideoStream', () => {
    test('should pause the video stream if processing', () => {
      mockStreamProcessor = {
        isProcessing: vi.fn().mockReturnValue(true),
        start: vi.fn(),
        setInferenceEnabled: vi.fn(),
        reset: vi.fn(),
        stop: vi.fn(),
        init: vi.fn(),
      };
      controller['streamProcessor'] = mockStreamProcessor as IStreamProcessor;
      controller['vitalsEstimateManager'].resetAll = vi.fn();

      controller.pauseVideoStream();
      expect(mockStreamProcessor.stop).toHaveBeenCalled();
      expect(controller['vitalsEstimateManager'].resetAll).toHaveBeenCalled();
    });

    test('should do nothing on pauseVideoStream if not processing', () => {
      mockStreamProcessor = {
        isProcessing: vi.fn().mockReturnValue(false),
        start: vi.fn(),
        setInferenceEnabled: vi.fn(),
        reset: vi.fn(),
        stop: vi.fn(),
        init: vi.fn(),
      };
      controller['streamProcessor'] = mockStreamProcessor as IStreamProcessor;
      controller['vitalsEstimateManager'].resetAll = vi.fn();

      controller.pauseVideoStream();
      expect(mockStreamProcessor.stop).not.toHaveBeenCalled();
      expect(
        controller['vitalsEstimateManager'].resetAll
      ).not.toHaveBeenCalled();
    });
  });

  describe('stopVideoStream', () => {
    test('should stop the streamProcessor (if exists) and reset vitalsEstimateManager', () => {
      mockStreamProcessor = {
        isProcessing: vi.fn().mockReturnValue(true),
        stop: vi.fn(),
        start: vi.fn(),
        setInferenceEnabled: vi.fn(),
        reset: vi.fn(),
        init: vi.fn(),
      };
      controller['streamProcessor'] = mockStreamProcessor as IStreamProcessor;
      controller['vitalsEstimateManager'].resetAll = vi.fn();

      controller.stopVideoStream();
      expect(mockStreamProcessor.stop).toHaveBeenCalled();
      expect(controller['streamProcessor']).toBeNull();
      expect(controller['vitalsEstimateManager'].resetAll).toHaveBeenCalled();
    });

    test('should call vitalsEstimateManager.resetAll even if streamProcessor is null', () => {
      controller['streamProcessor'] = null;
      controller['vitalsEstimateManager'].resetAll = vi.fn();

      controller.stopVideoStream();
      expect(controller['vitalsEstimateManager'].resetAll).toHaveBeenCalled();
    });
  });

  describe('processVideoFile', () => {
    test('should call createFileFrameIterator and processVideoFile correctly', async () => {
      const mockFileInput = 'path/to/video/file.mp4';

      const mockFrameIterator = {
        start: vi.fn(),
        stop: vi.fn(),
        getId: vi.fn().mockReturnValue('frameIteratorId'),
        [Symbol.asyncIterator]: vi.fn().mockReturnValue(
          (async function* () {
            yield { frames: [new Uint8Array([1, 2, 3])], timestamp: 0 };
            yield { frames: [new Uint8Array([4, 5, 6])], timestamp: 1 };
          })()
        ),
      };

      controller['frameIteratorFactory']!.createFileFrameIterator = vi
        .fn()
        .mockReturnValue(mockFrameIterator);

      const mockIncrementalResult = { some: 'incremental data' };
      controller['methodHandler'].process = vi
        .fn()
        .mockResolvedValue(mockIncrementalResult);
      controller['methodHandler'].init = vi.fn();
      controller['methodHandler'].cleanup = vi.fn();

      controller['vitalsEstimateManager'].processIncrementalResult = vi
        .fn()
        .mockResolvedValue({});
      const mockFinalResult = { message: 'Processing complete' };
      controller['vitalsEstimateManager'].getResult = vi
        .fn()
        .mockResolvedValue(mockFinalResult);

      const result = await controller.processVideoFile(mockFileInput);

      expect(
        controller['frameIteratorFactory']!.createFileFrameIterator
      ).toHaveBeenCalledWith(
        mockFileInput,
        controller['ffmpeg'],
        controller['faceDetectionWorker']
      );

      expect(controller['methodHandler'].init).toHaveBeenCalled();
      expect(mockFrameIterator.start).toHaveBeenCalled();

      expect(controller['methodHandler'].process).toHaveBeenCalledTimes(2);
      expect(controller['methodHandler'].process).toHaveBeenCalledWith(
        { frames: [new Uint8Array([1, 2, 3])], timestamp: 0 },
        'file',
        controller['bufferManager'].getState(),
        undefined
      );
      expect(controller['methodHandler'].process).toHaveBeenCalledWith(
        { frames: [new Uint8Array([4, 5, 6])], timestamp: 1 },
        'file',
        controller['bufferManager'].getState(),
        undefined
      );

      expect(
        controller['vitalsEstimateManager'].processIncrementalResult
      ).toHaveBeenCalledTimes(2);
      expect(
        controller['vitalsEstimateManager'].processIncrementalResult
      ).toHaveBeenCalledWith(
        mockIncrementalResult,
        'frameIteratorId',
        'complete',
        true,
        false
      );

      expect(controller['methodHandler'].cleanup).toHaveBeenCalled();
      expect(controller['vitalsEstimateManager'].reset).toHaveBeenCalledWith(
        'frameIteratorId'
      );

      expect(result).toEqual(mockFinalResult);
    });
  });

  describe('addEventListener', () => {
    test('should register a listener and trigger it on dispatchEvent', () => {
      const mockListener = vi.fn();

      controller.addEventListener('vitals', mockListener);

      const testData = { heartRate: 75 };
      controller['dispatchEvent']('vitals', testData);

      expect(mockListener).toHaveBeenCalledWith(testData);
    });
  });

  describe('removeEventListener', () => {
    test('should remove all listeners for an event', () => {
      const mockListener1 = vi.fn();
      const mockListener2 = vi.fn();
      controller.addEventListener('vitals', mockListener1);
      controller.addEventListener('vitals', mockListener2);

      controller.removeEventListener('vitals');

      controller['dispatchEvent']('vitals', { heartRate: 80 });
      expect(mockListener1).not.toHaveBeenCalled();
      expect(mockListener2).not.toHaveBeenCalled();
    });

    test('should do nothing if called for an event that does not exist', () => {
      expect(() => controller.removeEventListener('nonexistent')).not.toThrow();
    });
  });

  describe('dispose', () => {
    test('should terminate faceDetectionWorker, cleanup ffmpeg and streamProcessor, and reset managers', async () => {
      const fakeFaceDetectionWorker = {
        terminate: vi.fn().mockResolvedValue(undefined),
      };
      controller['faceDetectionWorker'] =
        fakeFaceDetectionWorker as unknown as IFaceDetectionWorker;
      const fakeFFmpeg = { cleanup: vi.fn() };
      controller['ffmpeg'] = fakeFFmpeg as unknown as IFFmpegWrapper;
      const fakeStreamProcessor = { stop: vi.fn() };
      controller['streamProcessor'] =
        fakeStreamProcessor as unknown as IStreamProcessor;
      controller['bufferManager'].cleanup = vi.fn();
      controller['vitalsEstimateManager'].resetAll = vi.fn();

      await controller.dispose();

      expect(fakeFaceDetectionWorker.terminate).toHaveBeenCalled();
      expect(controller['faceDetectionWorker']).toBeNull();
      expect(fakeFFmpeg.cleanup).toHaveBeenCalled();
      expect(controller['ffmpeg']).toBeNull();
      expect(fakeStreamProcessor.stop).toHaveBeenCalled();
      expect(controller['streamProcessor']).toBeNull();
      expect(controller['bufferManager'].cleanup).toHaveBeenCalled();
      expect(controller['vitalsEstimateManager'].resetAll).toHaveBeenCalled();
    });
  });

  describe('dispatchEvent', () => {
    test('should call all registered listeners on dispatchEvent', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      controller.addEventListener('vitals', listener1);
      controller.addEventListener('vitals', listener2);

      controller['dispatchEvent']('vitals', { heartRate: 88 });

      expect(listener1).toHaveBeenCalledWith({ heartRate: 88 });
      expect(listener2).toHaveBeenCalledWith({ heartRate: 88 });
    });
  });

  describe('isProcessing', () => {
    test('should return true if streamProcessor exists and is processing', () => {
      const fakeStreamProcessor = {
        isProcessing: vi.fn().mockReturnValue(true),
      };
      controller['streamProcessor'] =
        fakeStreamProcessor as unknown as IStreamProcessor;
      expect(controller['isProcessing']()).toBe(true);
    });
    test('should return false if streamProcessor is null', () => {
      controller['streamProcessor'] = null;
      expect(controller['isProcessing']()).toBe(false);
    });
    test('should return false if streamProcessor exists but is not processing', () => {
      const fakeStreamProcessor = {
        isProcessing: vi.fn().mockReturnValue(false),
      };
      controller['streamProcessor'] =
        fakeStreamProcessor as unknown as IStreamProcessor;
      expect(controller['isProcessing']()).toBe(false);
    });
  });

  describe('setInferenceEnabled', () => {
    test('should call setInferenceEnabled on streamProcessor if it exists', () => {
      const mockProc = {
        isProcessing: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        init: vi.fn(),
        setInferenceEnabled: vi.fn(),
        reset: vi.fn(),
      };
      controller['streamProcessor'] = mockProc as unknown as IStreamProcessor;

      controller.setInferenceEnabled(true);
      expect(mockProc.setInferenceEnabled).toHaveBeenCalledWith(true);
    });
  });

  describe('reset', () => {
    test('should call reset on streamProcessor if it exists', () => {
      const mockProc = {
        isProcessing: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        init: vi.fn(),
        setInferenceEnabled: vi.fn(),
        reset: vi.fn(),
      };
      controller['streamProcessor'] = mockProc as unknown as IStreamProcessor;

      controller.reset();
      expect(mockProc.reset).toHaveBeenCalled();
    });

    test('should cleanup bufferManager if streamProcessor does not exist', () => {
      controller['streamProcessor'] = null;
      controller['bufferManager'].cleanup = vi.fn();

      controller.reset();
      expect(controller['bufferManager'].cleanup).toHaveBeenCalled();
    });
  });
});
