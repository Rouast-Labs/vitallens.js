/* eslint-disable @typescript-eslint/no-explicit-any */

import { VitalLensController } from '../../src/core/VitalLensController.node';
import { VitalLensOptions } from '../../src/types';
import { RestClient } from '../../src/utils/RestClient.node';
import { WebSocketClient } from '../../src/utils/WebSocketClient.node';
import FFmpegWrapper from '../../src/utils/FFmpegWrapper.node';
import { StreamProcessor } from '../../src/processing/StreamProcessor.node';
import { FaceDetectionWorker } from '../../src/ssd/FaceDetectionWorker.node';
import { Worker } from 'worker_threads';

jest.mock('../../src/utils/RestClient.node');
jest.mock('../../src/utils/WebSocketClient.node');
jest.mock('../../src/utils/FFmpegWrapper.node');
jest.mock('../../src/processing/StreamProcessor.node');
jest.mock('../../src/ssd/FaceDetectionWorker.node');
jest.mock('worker_threads', () => {
  return {
    Worker: jest.fn(),
  };
});
jest.mock(
  '../../dist/faceDetection.worker.node.bundle.js',
  () => 'data:application/javascript;base64,ZmFrZSBjb2Rl'
);

describe('VitalLensController (Node)', () => {
  let controller: VitalLensController;
  const mockOptions: VitalLensOptions = {
    apiKey: 'test-key',
    method: 'vitallens',
    requestMode: 'rest',
  };

  beforeEach(() => {
    // Instantiate a new controller for each test.
    controller = new VitalLensController(mockOptions);
    jest.clearAllMocks();
  });

  describe('createRestClient', () => {
    test('should create a RestClient', () => {
      const restClient = (controller as any).createRestClient(
        mockOptions.apiKey
      );
      expect(RestClient).toHaveBeenCalledWith(mockOptions.apiKey);
      // Since RestClient is a mock constructor, we can also check that the returned value is an instance.
      expect(restClient).toBeInstanceOf(RestClient);
    });
  });

  describe('createWebSocketClient', () => {
    test('should create a WebSocketClient', () => {
      const wsClient = (controller as any).createWebSocketClient(
        mockOptions.apiKey
      );
      expect(WebSocketClient).toHaveBeenCalledWith(mockOptions.apiKey);
      expect(wsClient).toBeInstanceOf(WebSocketClient);
    });
  });

  describe('createFFmpegWrapper', () => {
    test('should create an FFmpegWrapper', () => {
      const ffmpeg = (controller as any).createFFmpegWrapper();
      expect(FFmpegWrapper).toHaveBeenCalled();
      expect(ffmpeg).toBeInstanceOf(FFmpegWrapper);
    });
  });

  describe('createFaceDetectionWorker', () => {
    test('should create a FaceDetectionWorker using an inline worker', () => {
      const faceWorker = (controller as any).createFaceDetectionWorker();
      // Ensure that the Worker was created using the inline code and with eval: true.
      expect(Worker).toHaveBeenCalled();
      const workerCallArgs = (Worker as unknown as jest.Mock).mock.calls[0];
      expect(workerCallArgs[1]).toEqual({ eval: true });
      // Check that the created faceWorker is an instance of FaceDetectionWorker.
      expect(faceWorker).toBeInstanceOf(FaceDetectionWorker);
    });
  });

  describe('createStreamProcessor', () => {
    test('should create a StreamProcessor', () => {
      // Create dummy parameters
      const dummyOptions = mockOptions;
      const dummyMethodConfig = {} as any;
      const dummyFrameIterator = {} as any;
      const dummyBufferManager = {} as any;
      const dummyFaceDetectionWorker = {} as any;
      const dummyMethodHandler = {} as any;
      const dummyOnPredict = jest.fn();
      const dummyOnNoFace = jest.fn();

      const streamProcessor = (controller as any).createStreamProcessor(
        dummyOptions,
        dummyMethodConfig,
        dummyFrameIterator,
        dummyBufferManager,
        dummyFaceDetectionWorker,
        dummyMethodHandler,
        dummyOnPredict,
        dummyOnNoFace
      );
      expect(StreamProcessor).toHaveBeenCalledWith(
        dummyOptions,
        dummyMethodConfig,
        dummyFrameIterator,
        dummyBufferManager,
        dummyFaceDetectionWorker,
        dummyMethodHandler,
        dummyOnPredict,
        dummyOnNoFace
      );
      expect(streamProcessor).toBeInstanceOf(StreamProcessor);
    });
  });

  describe('setVideoStream', () => {
    test('should throw an error if setVideoStream is called in Node environment', async () => {
      const mockStream = {} as any;
      const mockVideoElement = {} as any;
      await expect(
        controller.setVideoStream(mockStream, mockVideoElement)
      ).rejects.toThrowError(
        'setVideoStream is not supported yet in the Node environment.'
      );
    });
  });
});
