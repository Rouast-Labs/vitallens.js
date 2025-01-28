import { FrameIteratorFactory } from '../../src/processing/FrameIteratorFactory.node';
import FFmpegWrapper from '../../src/utils/FFmpegWrapper.node';
import { FileFrameIterator } from '../../src/processing/FileFrameIterator';
import { FileRGBIterator } from '../../src/processing/FileRGBIterator';
import { MethodConfig } from '../../src/types';
import { IFaceDetector } from '../../src/types/IFaceDetector';

const methodConfig: MethodConfig = { method: 'vitallens', fpsTarget: 30, roiMethod: 'face', minWindowLength: 5, maxWindowLength: 10, windowOverlap: 0, requiresState: false };
const mockFaceDetector: jest.Mocked<IFaceDetector> = {
  detect: jest.fn(),
  run: jest.fn(),
  load: jest.fn()
};

describe('FrameIteratorFactory (Node)', () => {
  let factory: FrameIteratorFactory;

  it('should return an instance of FFmpegWrapper.node from getFFmpegWrapper', () => {
    factory = new FrameIteratorFactory({ method: 'vitallens' });
    const ffmpegWrapper = factory['getFFmpegWrapper']();
    expect(ffmpegWrapper).toBeInstanceOf(FFmpegWrapper);
  });

  it('should create a FileFrameIterator for "vitallens" method', () => {
    const videoInput = 'test.mp4';
    factory = new FrameIteratorFactory({ method: 'vitallens' });
    const iterator = factory.createFileFrameIterator(videoInput, methodConfig, mockFaceDetector);
    expect(iterator).toBeInstanceOf(FileFrameIterator);
  });

  it('should create a FileRGBIterator for non-"vitallens" method', () => {
    factory = new FrameIteratorFactory({ method: 'pos' });
    const iterator = factory.createFileFrameIterator('test.mp4', methodConfig, mockFaceDetector);
    expect(iterator).toBeInstanceOf(FileRGBIterator);
  });

  it('should throw an error for createStreamFrameIterator in Node.js', () => {
    expect(() => factory.createStreamFrameIterator()).toThrowError(
      'Either a MediaStream or an HTMLVideoElement must be provided.',
    );
  });
});
