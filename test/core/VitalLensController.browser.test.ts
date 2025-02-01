import { VitalLensController } from '../../src/core/VitalLensController.browser';
import { FrameIteratorFactory } from '../../src/processing/FrameIteratorFactory.browser';
import { FaceDetectorAsync } from '../../src/ssd/FaceDetectorAsync.browser';
import { VitalLensOptions } from '../../src/types/core';
import { StreamProcessor } from '../../src/processing/StreamProcessor';

jest.mock('../../src/processing/FrameIteratorFactory.browser');
jest.mock('../../src/ssd/FaceDetectorAsync.browser');
jest.mock('../../src/processing/StreamProcessor');
jest.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: jest.fn(() => ({
    load: jest.fn(),
    FS: jest.fn(),
    run: jest.fn(),
  })),
}));
jest.mock('../../src/ssd/FaceDetectorAsync.browser', () => {
  return {
    FaceDetectorAsync: jest.fn().mockImplementation(() => ({
      init: jest.fn(),
      load: jest.fn(),
      detect: jest.fn(),
      run: jest.fn(),
    })),
  };
});

describe('VitalLensController (Browser)', () => {
  let controller: VitalLensController;
  const mockOptions: VitalLensOptions = { apiKey: 'test-key', method: 'vitallens', requestMode: 'rest' };

  beforeEach(() => {
    // Instantiate a new controller
    controller = new VitalLensController(mockOptions);
  });
  
  test('should create a Browser FrameIteratorFactory instance in constructor', () => {
    expect(FrameIteratorFactory).toHaveBeenCalledWith(mockOptions);
  });

  test('should create a Browser FaceDetectorAsync instance in constructor', () => {
    expect(FaceDetectorAsync).toHaveBeenCalled();
  });

  test('should throw an error if addStream() is called without initializing frameIteratorFactory', async () => {
    controller['frameIteratorFactory'] = null;
    await expect(controller.addStream()).rejects.toThrow('FrameIteratorFactory is not initialized.');
  });

  test('should call createStreamFrameIterator and create a StreamProcessor in addStream()', async () => {
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
    await controller.addStream(mockStream, mockVideoElement);
    expect(controller['frameIteratorFactory']!.createStreamFrameIterator).toHaveBeenCalledWith(
      mockStream,
      mockVideoElement
    );
    expect(StreamProcessor).toHaveBeenCalled();
  });

  // TODO: Test for Browser with processFile
});
