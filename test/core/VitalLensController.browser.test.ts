// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */

import { VitalLensController } from '../../src/core/VitalLensController.browser';
import { VitalLensOptions } from '../../src/types';
import { RestClient } from '../../src/utils/RestClient.browser';
import FFmpegWrapper from '../../src/utils/FFmpegWrapper.browser';
import { StreamProcessor } from '../../src/processing/StreamProcessor.browser';
import { FaceDetectionWorker } from '../../src/ssd/FaceDetectionWorker.browser';
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
      Session: class {
        constructor() {
          return {
            processJs: vi.fn(),
            reset: vi.fn(),
          };
        }
      },
    }),
  };
});
vi.mock('../../src/utils/RestClient.browser', () => {
  return {
    RestClient: vi.fn().mockImplementation(function (this: any) {
      this.resolveModel = vi.fn().mockResolvedValue({
        resolved_model: 'vitallens',
        config: { fps_target: 30, roi_method: 'face', supported_vitals: [] },
      });
      this.sendFrames = vi.fn();
    }),
  };
});
vi.mock('../../src/utils/FFmpegWrapper.browser');
vi.mock('../../src/processing/StreamProcessor.browser');
vi.mock('../../src/ssd/FaceDetectionWorker.browser');
vi.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: vi.fn(() => ({
    load: vi.fn(),
    FS: vi.fn(),
    run: vi.fn(),
  })),
}));
vi.mock('../../dist/faceDetection.worker.browser.bundle.js', () => ({
  default: 'data:application/javascript;base64,ZmFrZSBjb2Rl',
}));
global.URL.createObjectURL = vi.fn(
  () => 'data:application/javascript;base64,ZmFrZSBjb2Rl'
);

class FakeWorker extends EventTarget implements Worker {
  onerror: ((this: AbstractWorker, ev: ErrorEvent) => any) | null = null;
  onmessage: ((this: AbstractWorker, ev: MessageEvent) => any) | null = null;
  onmessageerror: ((this: AbstractWorker, ev: MessageEvent) => any) | null =
    null;

  addEventListener: Worker['addEventListener'] = vi.fn();
  removeEventListener: Worker['removeEventListener'] = vi.fn();
  postMessage: Worker['postMessage'] = vi.fn();
  terminate: Worker['terminate'] = vi.fn();
  dispatchEvent: Worker['dispatchEvent'] = vi.fn();

  constructor(
    public scriptURL: string | URL,
    public options?: WorkerOptions
  ) {
    super();
  }
}

const FakeWorkerMock = vi.fn().mockImplementation(function (
  scriptURL: string | URL,
  options?: WorkerOptions
) {
  return new FakeWorker(scriptURL, options);
});

global.Worker = FakeWorkerMock as unknown as typeof Worker;

describe('VitalLensController (Browser)', () => {
  let controller: VitalLensController;
  const mockOptions: VitalLensOptions = {
    apiKey: 'test-key',
    method: 'vitallens',
    requestMode: 'rest',
    proxyUrl: 'mock-url',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new VitalLensController(mockOptions);
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
      FakeWorkerMock.mockClear();
      (FaceDetectionWorker as vi.Mock).mockClear();

      (controller as any).createFaceDetectionWorker();

      expect(FakeWorkerMock).toHaveBeenCalledTimes(1);
      const callArgs = FakeWorkerMock.mock.calls[0];
      expect(callArgs[0]).toBe(
        'data:application/javascript;base64,ZmFrZSBjb2Rl'
      );
      expect(callArgs.length).toBe(2);

      const workerInstance = FakeWorkerMock.mock.results[0].value;
      expect(FaceDetectionWorker).toHaveBeenCalledTimes(1);
      expect(FaceDetectionWorker).toHaveBeenCalledWith(workerInstance);
    });
  });

  describe('createStreamProcessor', () => {
    test('should throw an error if setVideoStream is called without initializing frameIteratorFactory', async () => {
      controller['frameIteratorFactory'] = null;
      await expect(controller.setVideoStream()).rejects.toThrow(
        'FrameIteratorFactory is not initialized.'
      );
    });

    test('should call createStreamFrameIterator and create a StreamProcessor in setVideoStream', async () => {
      const mockStream = {} as MediaStream;
      const mockVideoElement = document.createElement('video');
      const mockFrameIterator = {
        start: vi.fn(),
        stop: vi.fn(),
        [Symbol.asyncIterator]: vi.fn().mockReturnValue({
          next: vi.fn().mockResolvedValue({ value: null, done: true }),
        }),
      };
      controller['frameIteratorFactory']!.createStreamFrameIterator = vi
        .fn()
        .mockReturnValue(mockFrameIterator);
      await controller.setVideoStream(mockStream, mockVideoElement);
      expect(
        controller['frameIteratorFactory']!.createStreamFrameIterator
      ).toHaveBeenCalledWith(mockStream, mockVideoElement);
      expect(StreamProcessor).toHaveBeenCalledWith(
        mockOptions,
        expect.any(Function), // getConfig
        expect.any(Object), // frameIterator
        expect.any(Object), // bufferManager
        expect.any(Object), // faceDetectionWorker
        expect.any(Object), // methodHandler
        expect.any(Function), // onPredict
        expect.any(Function), // onNoFace
        expect.any(Function), // onStreamReset
        expect.any(Function) // onFaceDetected
      );
    });
  });
});
