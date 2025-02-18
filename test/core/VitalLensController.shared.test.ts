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
import { IWebSocketClient } from '../../src/types/IWebSocketClient';
import { IFFmpegWrapper } from '../../src/types/IFFmpegWrapper';
import { IFaceDetectionWorker } from '../../src/types/IFaceDetectionWorker';
import { IFrameIterator } from '../../src/types/IFrameIterator';
import { MethodHandler } from '../../src/methods/MethodHandler';
import { IStreamProcessor } from '../../src/types/IStreamProcessor';
import { FrameIteratorFactory } from '../../src/processing/FrameIteratorFactory';

jest.mock('../../src/processing/BufferManager');
jest.mock('../../src/processing/FrameIteratorFactory');
jest.mock('../../src/methods/MethodHandler');
jest.mock('../../src/methods/MethodHandlerFactory');
jest.mock('../../src/processing/VitalsEstimateManager');

class TestVitalLensController extends VitalLensControllerBase {
  protected createRestClient(apiKey: string): IRestClient {
    return { sendFrames: jest.fn() };
  }
  protected createWebSocketClient(apiKey: string): IWebSocketClient {
    return {
      connect: jest.fn(),
      sendFrames: jest.fn(),
      getIsConnected: jest.fn(),
      close: jest.fn(),
    };
  }
  protected createFFmpegWrapper(): IFFmpegWrapper {
    return {
      init: jest.fn(),
      loadInput: jest.fn(),
      cleanup: jest.fn(),
      probeVideo: jest.fn(),
      readVideo: jest.fn(),
    };
  }
  protected createFaceDetectionWorker(): IFaceDetectionWorker {
    return {
      postMessage: jest.fn(),
      terminate: jest.fn(),
      onmessage: jest.fn(),
      onmessageerror: jest.fn(),
      onerror: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      detectFaces: jest.fn(),
    };
  }
  protected createStreamProcessor(
    options: VitalLensOptions,
    methodConfig: MethodConfig,
    frameIterator: IFrameIterator,
    bufferManager: BufferManager,
    faceDetectionWorker: IFaceDetectionWorker | null,
    methodHandler: MethodHandler,
    onPredict: (result: VitalLensResult) => Promise<void>,
    onNoFace: () => Promise<void>
  ): IStreamProcessor {
    return {
      init: jest.fn(),
      start: jest.fn(),
      isProcessing: jest.fn(),
      stop: jest.fn(),
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
    // Mock MethodHandlerFactory return value
    (MethodHandlerFactory.createHandler as jest.Mock).mockReturnValue({
      init: jest.fn(),
      cleanup: jest.fn(),
      getReady: jest.fn().mockReturnValue(true),
      process: jest.fn(),
      postprocess: jest.fn(),
    });
    // Instantiate a new controller
    controller = new TestVitalLensController(mockOptions);
    // Reset streamProcessor to undefined initially
    controller['streamProcessor'] = null;
  });

  describe('constructor', () => {
    test('should initialize components', () => {
      expect(BufferManager).toHaveBeenCalled();
      expect(FrameIteratorFactory).toHaveBeenCalled();
      expect(VitalsEstimateManager).toHaveBeenCalledWith(
        expect.any(Object),
        mockOptions,
        expect.any(Function)
      );
      expect(MethodHandlerFactory.createHandler).toHaveBeenCalledWith(
        mockOptions,
        expect.any(Object)
      );
    });
    test('should create faceDetectionWorker if globalRoi is undefined', () => {
      // With globalRoi undefined (as in mockOptions), faceDetectionWorker should be created.
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
    // test('should create a MethodHandler with correct dependencies (WebSocket)', () => {
    //   const optionsWithWebSocket: VitalLensOptions = {
    //     apiKey: 'test-key',
    //     method: 'vitallens',
    //     requestMode: 'websocket',
    //   };
    //   const methodHandlerWithWebSocket =
    //     controller['createMethodHandler'](optionsWithWebSocket);
    //   expect(MethodHandlerFactory.createHandler).toHaveBeenCalledWith(
    //     optionsWithWebSocket,
    //     {
    //       webSocketClient: expect.any(Object),
    //       restClient: undefined,
    //     }
    //   );
    //   expect(methodHandlerWithWebSocket).toBeDefined();
    // });

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
          webSocketClient: undefined,
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
      ).toThrowError(/An API key is required/);
    });

    test('should throw an error if requestMode is websocket', () => {
      const optionsWithWebSocket: VitalLensOptions = {
        method: 'vitallens',
        apiKey: 'test-key',
        requestMode: 'websocket',
      };
      expect(() =>
        controller['createMethodHandler'](optionsWithWebSocket)
      ).toThrowError(/WebSocket request mode is disabled for now/);
    });

    test('should create a MethodHandler without requiring an apiKey for non-vitallens methods', () => {
      const optionsForOtherMethod: VitalLensOptions = { method: 'pos' };
      const methodHandler = controller['createMethodHandler'](
        optionsForOtherMethod
      );
      expect(MethodHandlerFactory.createHandler).toHaveBeenCalledWith(
        optionsForOtherMethod,
        {
          webSocketClient: undefined,
          restClient: undefined,
        }
      );
      expect(methodHandler).toBeDefined();
    });
  });

  describe('startVideoStream', () => {
    test('should start the video stream if not already processing', () => {
      // Create a mock stream processor that is not processing
      mockStreamProcessor = {
        isProcessing: jest.fn().mockReturnValue(false),
        start: jest.fn(),
      };
      controller['streamProcessor'] = mockStreamProcessor as IStreamProcessor;

      controller.startVideoStream();
      expect(mockStreamProcessor.start).toHaveBeenCalled();
    });

    test('should not start the video stream if already processing', () => {
      // Create a mock stream processor that is already processing
      mockStreamProcessor = {
        isProcessing: jest.fn().mockReturnValue(true),
        start: jest.fn(),
      };
      controller['streamProcessor'] = mockStreamProcessor as IStreamProcessor;

      controller.startVideoStream();
      expect(mockStreamProcessor.start).not.toHaveBeenCalled();
    });
  });

  describe('pauseVideoStream', () => {
    test('should pause the video stream if processing', () => {
      // Create a mock stream processor that is processing
      mockStreamProcessor = {
        isProcessing: jest.fn().mockReturnValue(true),
        stop: jest.fn(),
      };
      controller['streamProcessor'] = mockStreamProcessor as IStreamProcessor;
      controller['vitalsEstimateManager'].resetAll = jest.fn();

      controller.pauseVideoStream();
      expect(mockStreamProcessor.stop).toHaveBeenCalled();
      expect(controller['vitalsEstimateManager'].resetAll).toHaveBeenCalled();
    });

    test('should do nothing on pauseVideoStream if not processing', () => {
      // Create a mock stream processor that is not processing
      mockStreamProcessor = {
        isProcessing: jest.fn().mockReturnValue(false),
        stop: jest.fn(),
      };
      controller['streamProcessor'] = mockStreamProcessor as IStreamProcessor;
      controller['vitalsEstimateManager'].resetAll = jest.fn();

      controller.pauseVideoStream();
      expect(mockStreamProcessor.stop).not.toHaveBeenCalled();
      expect(
        controller['vitalsEstimateManager'].resetAll
      ).not.toHaveBeenCalled();
    });
  });

  describe('stopVideoStream', () => {
    test('should stop the streamProcessor (if exists) and reset vitalsEstimateManager', () => {
      // Create a mock stream processor that is processing
      mockStreamProcessor = {
        stop: jest.fn(),
      };
      controller['streamProcessor'] = mockStreamProcessor as IStreamProcessor;
      controller['vitalsEstimateManager'].resetAll = jest.fn();

      controller.stopVideoStream();
      expect(mockStreamProcessor.stop).toHaveBeenCalled();
      expect(controller['streamProcessor']).toBeNull();
      expect(controller['vitalsEstimateManager'].resetAll).toHaveBeenCalled();
    });

    test('should call vitalsEstimateManager.resetAll even if streamProcessor is null', () => {
      controller['streamProcessor'] = null;
      controller['vitalsEstimateManager'].resetAll = jest.fn();

      controller.stopVideoStream();
      expect(controller['vitalsEstimateManager'].resetAll).toHaveBeenCalled();
    });
  });

  describe('processVideoFile', () => {
    test('should call createFileFrameIterator and processVideoFile correctly', async () => {
      const mockFileInput = 'path/to/video/file.mp4';

      // Mock frame iterator
      const mockFrameIterator = {
        start: jest.fn(),
        stop: jest.fn(),
        getId: jest.fn().mockReturnValue('frameIteratorId'),
        [Symbol.asyncIterator]: jest.fn().mockReturnValue(
          (async function* () {
            yield { frames: [new Uint8Array([1, 2, 3])], timestamp: 0 }; // Simulated frame chunk
            yield { frames: [new Uint8Array([4, 5, 6])], timestamp: 1 }; // Another frame chunk
          })()
        ),
      };

      // Override the frame iterator factory to return our fake iterator
      controller['frameIteratorFactory']!.createFileFrameIterator = jest
        .fn()
        .mockReturnValue(mockFrameIterator);

      const mockIncrementalResult = { some: 'incremental data' };
      controller['methodHandler'].process = jest
        .fn()
        .mockResolvedValue(mockIncrementalResult);
      controller['methodHandler'].init = jest.fn();
      controller['methodHandler'].cleanup = jest.fn();

      controller['vitalsEstimateManager'].processIncrementalResult = jest
        .fn()
        .mockResolvedValue({});
      const mockFinalResult = { message: 'Processing complete' };
      controller['vitalsEstimateManager'].getResult = jest
        .fn()
        .mockResolvedValue(mockFinalResult);

      // Run processVideoFile
      const result = await controller.processVideoFile(mockFileInput);

      // Verify createFileFrameIterator was called
      expect(
        controller['frameIteratorFactory']!.createFileFrameIterator
      ).toHaveBeenCalledWith(
        mockFileInput,
        controller['methodConfig'],
        controller['ffmpeg'],
        controller['faceDetectionWorker']
      );

      // Ensure dependencies are initialized
      expect(controller['methodHandler'].init).toHaveBeenCalled();
      expect(mockFrameIterator.start).toHaveBeenCalled();

      // Ensure process was called for each frame chunk
      expect(controller['methodHandler'].process).toHaveBeenCalledTimes(2);
      expect(controller['methodHandler'].process).toHaveBeenCalledWith(
        { frames: [new Uint8Array([1, 2, 3])], timestamp: 0 },
        controller['bufferManager'].getState()
      );
      expect(controller['methodHandler'].process).toHaveBeenCalledWith(
        { frames: [new Uint8Array([4, 5, 6])], timestamp: 1 },
        controller['bufferManager'].getState()
      );

      // Ensure vitalsEstimateManager processes incremental results
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

      // Ensure final cleanup is called and buffer state reset for this file ID
      expect(controller['methodHandler'].cleanup).toHaveBeenCalled();
      expect(controller['vitalsEstimateManager'].reset).toHaveBeenCalledWith(
        'frameIteratorId'
      );

      // Verify final result
      expect(result).toEqual(mockFinalResult);
    });
  });

  describe('addEventListener', () => {
    test('should register a listener and trigger it on dispatchEvent', () => {
      const mockListener = jest.fn();

      // Register the listener for the 'vitals' event.
      controller.addEventListener('vitals', mockListener);

      // Dispatch the event with some data.
      const testData = { heartRate: 75 };
      controller['dispatchEvent']('vitals', testData);

      // Verify that the listener was called with the correct data.
      expect(mockListener).toHaveBeenCalledWith(testData);
    });
  });

  describe('removeEventListener', () => {
    test('should remove all listeners for an event', () => {
      const mockListener1 = jest.fn();
      const mockListener2 = jest.fn();
      controller.addEventListener('vitals', mockListener1);
      controller.addEventListener('vitals', mockListener2);

      // Remove all listeners for 'vitals'
      controller.removeEventListener('vitals');

      // Dispatching the event should not call any listeners
      controller['dispatchEvent']('vitals', { heartRate: 80 });
      expect(mockListener1).not.toHaveBeenCalled();
      expect(mockListener2).not.toHaveBeenCalled();
    });

    test('should do nothing if called for an event that does not exist', () => {
      // This should not throw an error
      expect(() => controller.removeEventListener('nonexistent')).not.toThrow();
    });
  });

  describe('dispose', () => {
    test('should terminate faceDetectionWorker, cleanup ffmpeg and streamProcessor, and reset managers', async () => {
      const fakeFaceDetectionWorker = {
        terminate: jest.fn().mockResolvedValue(undefined),
      };
      controller['faceDetectionWorker'] =
        fakeFaceDetectionWorker as unknown as IFaceDetectionWorker;
      const fakeFFmpeg = { cleanup: jest.fn() };
      controller['ffmpeg'] = fakeFFmpeg as unknown as IFFmpegWrapper;
      const fakeStreamProcessor = { stop: jest.fn() };
      controller['streamProcessor'] =
        fakeStreamProcessor as unknown as IStreamProcessor;
      controller['bufferManager'].cleanup = jest.fn();
      controller['vitalsEstimateManager'].resetAll = jest.fn();

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
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      controller.addEventListener('vitals', listener1);
      controller.addEventListener('vitals', listener2);

      // Directly call the private dispatchEvent (or via a public API that triggers it)
      controller['dispatchEvent']('vitals', { heartRate: 88 });

      expect(listener1).toHaveBeenCalledWith({ heartRate: 88 });
      expect(listener2).toHaveBeenCalledWith({ heartRate: 88 });
    });
  });

  describe('isProcessing', () => {
    test('should return true if streamProcessor exists and is processing', () => {
      const fakeStreamProcessor = {
        isProcessing: jest.fn().mockReturnValue(true),
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
        isProcessing: jest.fn().mockReturnValue(false),
      };
      controller['streamProcessor'] =
        fakeStreamProcessor as unknown as IStreamProcessor;
      expect(controller['isProcessing']()).toBe(false);
    });
  });
});
