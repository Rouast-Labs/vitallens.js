import { FrameIteratorFactory } from '../../src/processing/FrameIteratorFactory';
import { FileFrameIterator } from '../../src/processing/FileFrameIterator';
import { FileRGBIterator } from '../../src/processing/FileRGBIterator';
import { MethodConfig, VitalLensOptions } from '../../src/types';

const dummyFFmpeg = {
  init: jest.fn(),
  loadInput: jest.fn(),
  probeVideo: jest.fn(),
  readVideo: jest.fn(),
  cleanup: jest.fn(),
};

const dummyFaceDetectionWorker = {
  detectFaces: jest.fn(),
  postMessage: jest.fn(),
  terminate: jest.fn(),
  onmessage: null,
  onmessageerror: null,
};

const methodConfig: MethodConfig = {
  method: 'vitallens',
  fpsTarget: 30,
  roiMethod: 'face',
  minWindowLength: 5,
  maxWindowLength: 10,
  requiresState: false,
  bufferOffset: 1,
  supportedVitals: ['ppg_waveform', 'heart_rate'],
};

describe('FrameIteratorFactory', () => {
  let factory: FrameIteratorFactory;

  describe('createFileFrameIterator', () => {
    it('should create a FileFrameIterator for "vitallens" method', () => {
      const videoInput = 'test.mp4';
      // Create a factory with options that indicate "vitallens" is the selected method.
      factory = new FrameIteratorFactory(
        { method: 'vitallens' } as VitalLensOptions,
        () => methodConfig
      );
      const iterator = factory.createFileFrameIterator(
        videoInput,
        dummyFFmpeg,
        dummyFaceDetectionWorker
      );
      expect(iterator).toBeInstanceOf(FileFrameIterator);
    });

    it('should create a FileRGBIterator for non-"vitallens" method', () => {
      // Create a factory with options that indicate another method (e.g. "pos").
      factory = new FrameIteratorFactory(
        { method: 'pos' } as VitalLensOptions,
        () => methodConfig
      );
      const iterator = factory.createFileFrameIterator(
        'test.mp4',
        dummyFFmpeg,
        dummyFaceDetectionWorker
      );
      expect(iterator).toBeInstanceOf(FileRGBIterator);
    });
  });
});
