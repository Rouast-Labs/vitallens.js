import { FrameIteratorFactory } from '../../src/processing/FrameIteratorFactory.browser';
import { StreamFrameIterator } from '../../src/processing/StreamFrameIterator';
import { FileFrameIterator } from '../../src/processing/FileFrameIterator';
import { FileRGBIterator } from '../../src/processing/FileRGBIterator';
import { IFaceDetector } from '../../src/types/IFaceDetector';
import { MethodConfig } from '../../src/types';

jest.mock('@ffmpeg/ffmpeg', () => {
  return {
    FFmpeg: jest.fn().mockImplementation(() => ({
      load: jest.fn(),
      FS: jest.fn(),
      run: jest.fn(),
      fetchFile: jest.fn(),
    })),
  };
});

jest.mock('../../src/utils/FFmpegWrapper.browser', () => {
  const OriginalFFmpegWrapper = jest.requireActual('../../src/utils/FFmpegWrapper.browser').default;
  class MockFFmpegWrapper { processVideo = jest.fn(); }
  Object.setPrototypeOf(MockFFmpegWrapper.prototype, OriginalFFmpegWrapper.prototype);
  return MockFFmpegWrapper;
});

import FFmpegWrapper from '../../src/utils/FFmpegWrapper.browser';

global.MediaStream = class MediaStream {
  active = true;
  id = 'mock-stream-id';
  getTracks = jest.fn();
  getAudioTracks = jest.fn();
  getVideoTracks = jest.fn();
  addTrack = jest.fn();
  removeTrack = jest.fn();
  clone = jest.fn();
  onaddtrack = null;
  onremovetrack = null;
} as unknown as typeof MediaStream;

const methodConfig: MethodConfig = { method: 'vitallens', fpsTarget: 30, roiMethod: 'face', minWindowLength: 5, maxWindowLength: 10, windowOverlap: 0, requiresState: false };
const mockFaceDetector: jest.Mocked<IFaceDetector> = { detect: jest.fn(), run: jest.fn(), load: jest.fn() };

describe('FrameIteratorFactory (Browser)', () => {
  let factory: FrameIteratorFactory;

  it('should return an instance of FFmpegWrapper.browser from getFFmpegWrapper', () => {
    factory = new FrameIteratorFactory({ method: 'vitallens' });
    const ffmpegWrapper = factory['getFFmpegWrapper']();
    expect(ffmpegWrapper).toBeInstanceOf(FFmpegWrapper);
  });

  it('should create a StreamFrameIterator with MediaStream', () => {
    factory = new FrameIteratorFactory({ method: 'vitallens' });
    const stream = new MediaStream();
    const iterator = factory.createStreamFrameIterator(stream);
    expect(iterator).toBeInstanceOf(StreamFrameIterator);
  });

  it('should create a StreamFrameIterator with HTMLVideoElement', () => {
    factory = new FrameIteratorFactory({ method: 'vitallens' });
    const videoElement = document.createElement('video') as HTMLVideoElement;
  
    // Mock the `srcObject` property to accept a MediaStream
    Object.defineProperty(videoElement, 'srcObject', {
      value: new MediaStream(),
      writable: true,
    });
  
    const iterator = factory.createStreamFrameIterator(undefined, videoElement);
    expect(iterator).toBeInstanceOf(StreamFrameIterator);
  });

  it('should throw an error if neither MediaStream nor HTMLVideoElement is provided', () => {
    expect(() => factory.createStreamFrameIterator()).toThrowError(
      'Either a MediaStream or an HTMLVideoElement must be provided.',
    );
  });

  it('should create a FileFrameIterator for "vitallens" method', () => {
    factory = new FrameIteratorFactory({ method: 'vitallens' });
    const iterator = factory.createFileFrameIterator('test.mp4', methodConfig, mockFaceDetector);
    expect(iterator).toBeInstanceOf(FileFrameIterator);
  });

  it('should create a FileRGBIterator for non-"vitallens" method', () => {
    factory = new FrameIteratorFactory({ method: 'pos' });
    const iterator = factory.createFileFrameIterator('test.mp4', methodConfig, mockFaceDetector);
    expect(iterator).toBeInstanceOf(FileRGBIterator);
  });
});
