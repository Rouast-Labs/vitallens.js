import { FrameIteratorFactory } from '../../src/processing/FrameIteratorFactory';
import { FileFrameIterator } from '../../src/processing/FileFrameIterator';
import { FileRGBIterator } from '../../src/processing/FileRGBIterator';
import { MethodConfig, VitalLensOptions } from '../../src/types';
import { describe, expect, vi, it } from 'vitest';

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
    }),
  };
});

const dummyFFmpeg = {
  init: vi.fn(),
  loadInput: vi.fn(),
  probeVideo: vi.fn(),
  readVideo: vi.fn(),
  cleanup: vi.fn(),
};

const dummyFaceDetectionWorker = {
  detectFaces: vi.fn(),
  postMessage: vi.fn(),
  terminate: vi.fn(),
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
