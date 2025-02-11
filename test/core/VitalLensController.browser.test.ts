/* eslint-disable @typescript-eslint/no-explicit-any */

import { VitalLensController } from '../../src/core/VitalLensController.browser';
import { VitalLensOptions } from '../../src/types';
import { RestClient } from '../../src/utils/RestClient.browser';
import { WebSocketClient } from '../../src/utils/WebSocketClient.browser';
import FFmpegWrapper from '../../src/utils/FFmpegWrapper.browser';
import { StreamProcessor } from '../../src/processing/StreamProcessor.browser';
import { FaceDetectionWorker } from '../../src/ssd/FaceDetectionWorker.browser';

jest.mock('../../src/utils/RestClient.browser');
jest.mock('../../src/utils/WebSocketClient.browser');
jest.mock('../../src/utils/FFmpegWrapper.browser');
jest.mock('../../src/processing/StreamProcessor.browser');
jest.mock('../../src/ssd/FaceDetectionWorker.browser');
jest.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: jest.fn(() => ({
    load: jest.fn(),
    FS: jest.fn(),
    run: jest.fn(),
  })),
}));
jest.mock(
  '../../dist/faceDetection.worker.browser.bundle.js',
  () => 'data:application/javascript;base64,ZmFrZSBjb2Rl'
);

// Define a FakeWorker that implements the Worker interface.
class FakeWorker extends EventTarget implements Worker {
  onerror: ((this: AbstractWorker, ev: ErrorEvent) => any) | null = null;
  onmessage: ((this: AbstractWorker, ev: MessageEvent) => any) | null = null;
  onmessageerror: ((this: AbstractWorker, ev: MessageEvent) => any) | null =
    null;

  addEventListener: Worker['addEventListener'] = jest.fn();
  removeEventListener: Worker['removeEventListener'] = jest.fn();
  postMessage: Worker['postMessage'] = jest.fn();
  terminate: Worker['terminate'] = jest.fn();
  dispatchEvent: Worker['dispatchEvent'] = jest.fn();

  constructor(
    public scriptURL: string | URL,
    public options?: WorkerOptions
  ) {
    super();
  }
}

// Wrap FakeWorker in a jest mock constructor so we can inspect its calls.
const FakeWorkerMock = jest
  .fn()
  .mockImplementation((scriptURL: string | URL, options?: WorkerOptions) => {
    return new FakeWorker(scriptURL, options);
  });
// Assign our mock to the global Worker.
global.Worker = FakeWorkerMock as unknown as typeof Worker;

describe('VitalLensController (Browser)', () => {
  let controller: VitalLensController;
  const mockOptions: VitalLensOptions = {
    apiKey: 'test-key',
    method: 'vitallens',
    requestMode: 'rest',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Instantiate a new controller for each test.
    controller = new VitalLensController(mockOptions);
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
      // Clear any previous calls.
      FakeWorkerMock.mockClear();
      (FaceDetectionWorker as jest.Mock).mockClear();

      // Call the method.
      (controller as any).createFaceDetectionWorker();

      // Verify that our FakeWorkerMock was called with the inline worker bundle.
      expect(FakeWorkerMock).toHaveBeenCalledTimes(1);
      const callArgs = FakeWorkerMock.mock.calls[0];
      expect(callArgs[0]).toBe(
        'data:application/javascript;base64,ZmFrZSBjb2Rl'
      );
      expect(callArgs.length).toBe(1);

      // Get the worker instance created by FakeWorkerMock.
      const workerInstance = FakeWorkerMock.mock.results[0].value;
      // Verify that FaceDetectionWorker was constructed with that worker instance.
      expect(FaceDetectionWorker).toHaveBeenCalledTimes(1);
      expect(FaceDetectionWorker).toHaveBeenCalledWith(workerInstance);
    });
  });

  describe('createStreamProcessor', () => {
    test('should throw an error if setVideoStream is called without initializing frameIteratorFactory', async () => {
      // If frameIteratorFactory is missing, setVideoStream should throw.
      controller['frameIteratorFactory'] = null;
      await expect(controller.setVideoStream()).rejects.toThrow(
        'FrameIteratorFactory is not initialized.'
      );
    });

    test('should call createStreamFrameIterator and create a StreamProcessor in setVideoStream', async () => {
      const mockStream = {} as MediaStream;
      const mockVideoElement = document.createElement('video');
      const mockFrameIterator = {
        start: jest.fn(),
        stop: jest.fn(),
        [Symbol.asyncIterator]: jest.fn().mockReturnValue({
          next: jest.fn().mockResolvedValue({ value: null, done: true }),
        }),
      };
      controller['frameIteratorFactory']!.createStreamFrameIterator = jest
        .fn()
        .mockReturnValue(mockFrameIterator);
      await controller.setVideoStream(mockStream, mockVideoElement);
      expect(
        controller['frameIteratorFactory']!.createStreamFrameIterator
      ).toHaveBeenCalledWith(mockStream, mockVideoElement);
      expect(StreamProcessor).toHaveBeenCalled();
    });
  });
});
