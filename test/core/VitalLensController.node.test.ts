/* eslint-disable @typescript-eslint/no-explicit-any */

import { VitalLensController } from '../../src/core/VitalLensController.node';
import { VitalLensOptions } from '../../src/types';
import { RestClient } from '../../src/utils/RestClient.node';
import FFmpegWrapper from '../../src/utils/FFmpegWrapper.node';
import { StreamProcessor } from '../../src/processing/StreamProcessor.node';
import { FaceDetectionWorker } from '../../src/ssd/FaceDetectionWorker.node';
import { Worker } from 'worker_threads';
import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/core/wasmProvider', () => {
  return {
    getCore: vi.fn().mockResolvedValue({
      calculateRoi: vi.fn().mockReturnValue({ x: 0, y: 0, width: 100, height: 100 }),
      computeBufferConfig: vi.fn().mockReturnValue({}),
      BufferPlanner: vi.fn().mockImplementation(() => ({
        evaluateTarget: vi.fn(),
        poll: vi.fn(),
      })),
      Session: class {
        constructor() {
          return {
            processJs: vi.fn(),
            reset: vi.fn(),
          };
        }
      },
    })
  };
});
vi.mock('../../src/utils/RestClient.node');
vi.mock('../../src/utils/FFmpegWrapper.node');
vi.mock('../../src/processing/StreamProcessor.node');
vi.mock('../../src/ssd/FaceDetectionWorker.node');
vi.mock('worker_threads', () => {
  return {
    Worker: vi.fn().mockImplementation(function () {
      return {
        postMessage: vi.fn(),
        terminate: vi.fn(),
        on: vi.fn(),
      };
    }),
  };
});
vi.mock('../../dist/faceDetection.worker.node.bundle.js', () => ({
  default: 'data:application/javascript;base64,ZmFrZSBjb2Rl',
}));

describe('VitalLensController (Node)', () => {
  let controller: VitalLensController;
  const mockOptions: VitalLensOptions = {
    apiKey: 'test-key',
    method: 'vitallens',
    requestMode: 'rest',
  };

  beforeEach(() => {
    controller = new VitalLensController(mockOptions);
    vi.clearAllMocks();
  });

  describe('createRestClient', () => {
    test('should create a RestClient if API key provided', () => {
      const restClient = (controller as any).createRestClient(
        mockOptions.apiKey
      );
      expect(RestClient).toHaveBeenCalledWith(mockOptions.apiKey, undefined);
      expect(restClient).toBeInstanceOf(RestClient);
    });

    test('should create a RestClient if proxyUrl provided', () => {
      const restClient = (controller as any).createRestClient(
        '',
        mockOptions.proxyUrl
      );
      expect(RestClient).toHaveBeenCalledWith('', mockOptions.proxyUrl);
      expect(restClient).toBeInstanceOf(RestClient);
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
      expect(Worker).toHaveBeenCalled();
      const workerCallArgs = vi.mocked(Worker).mock.calls[0];
      expect(workerCallArgs[1]).toEqual({ eval: true });
      expect(faceWorker).toBeInstanceOf(FaceDetectionWorker);
    });
  });

  describe('createStreamProcessor', () => {
    test('should create a StreamProcessor', () => {
      const dummyOptions = mockOptions;
      const dummyMethodConfig = {} as any;
      const dummyFrameIterator = {} as any;
      const dummyBufferManager = {} as any;
      const dummyFaceDetectionWorker = {} as any;
      const dummyMethodHandler = {} as any;
      const dummyBufferedResultsConsumer = {} as any;
      const dummyOnPredict = vi.fn();
      const dummyOnNoFace = vi.fn();
      const dummyOnStreamReset = vi.fn();
      const dummyOnFaceDetected = vi.fn();

      const streamProcessor = (controller as any).createStreamProcessor(
        dummyOptions,
        dummyMethodConfig,
        dummyFrameIterator,
        dummyBufferManager,
        dummyFaceDetectionWorker,
        dummyMethodHandler,
        dummyBufferedResultsConsumer,
        dummyOnPredict,
        dummyOnNoFace,
        dummyOnStreamReset,
        dummyOnFaceDetected
      );
      expect(StreamProcessor).toHaveBeenCalledWith(
        dummyOptions,
        dummyMethodConfig,
        dummyFrameIterator,
        dummyBufferManager,
        dummyFaceDetectionWorker,
        dummyMethodHandler,
        dummyBufferedResultsConsumer,
        dummyOnPredict,
        dummyOnNoFace,
        dummyOnStreamReset,
        dummyOnFaceDetected
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
      ).rejects.toThrow(
        'setVideoStream is not supported yet in the Node environment.'
      );
    });
  });
});
