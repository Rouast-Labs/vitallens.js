/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  FileRGBIterator,
  extractRGBForROI,
} from '../../src/processing/FileRGBIterator';
import { Frame } from '../../src/processing/Frame';
import {
  VideoProbeResult,
  ROI,
  VitalLensOptions,
  MethodConfig,
  VideoInput,
} from '../../src/types/core';
import { IFFmpegWrapper } from '../../src/types/IFFmpegWrapper';
import { IFaceDetector } from '../../src/types/IFaceDetector';
import { IFaceDetectionWorker } from '../../src/types/IFaceDetectionWorker';

// Dummy FFmpeg wrapper that simulates behavior for testing.
class DummyFFmpegWrapper implements IFFmpegWrapper {
  init = jest.fn(async () => Promise.resolve());
  loadInput = jest.fn(async (videoInput: VideoInput): Promise<string> => {
    return 'test.mp4';
  });
  probeVideo = jest.fn(
    async (videoInput: VideoInput): Promise<VideoProbeResult> => {
      return {
        totalFrames: 20,
        fps: 10,
        width: 640,
        height: 480,
        codec: 'h264',
        bitrate: 1000,
        rotation: 0,
        issues: false,
      };
    }
  );
  readVideo = jest.fn(
    async (
      videoInput: VideoInput,
      options: any,
      probeInfo: VideoProbeResult
    ): Promise<Uint8Array> => {
      const startFrame: number = options.trim.startFrame;
      const endFrame: number = options.trim.endFrame;
      const fps = probeInfo.fps;
      const dsFactor =
        options.fpsTarget && options.fpsTarget < fps
          ? Math.round(fps / options.fpsTarget)
          : 1;
      const chunkFrameCount = Math.ceil((endFrame - startFrame) / dsFactor);
      const crop = options.crop as ROI;
      const unionWidth = crop.x1 - crop.x0;
      const unionHeight = crop.y1 - crop.y0;
      const totalBytes = chunkFrameCount * unionWidth * unionHeight * 3;
      return new Uint8Array(totalBytes).fill(50);
    }
  );
  cleanup = jest.fn(() => {});
}

// Dummy face detection worker that returns the same ROI for every frame.
class DummyFaceDetectionWorker implements IFaceDetectionWorker {
  postMessage(message: unknown, transfer?: Transferable[]): void {}
  terminate(): void | Promise<number> {
    return;
  }
  onmessage: ((ev: MessageEvent) => unknown) | null = null;
  onmessageerror: ((ev: MessageEvent) => unknown) | null = null;
  onerror: ((ev: ErrorEvent) => unknown) | null = null;
  addEventListener?(
    type: string,
    listener: EventListenerOrEventListenerObject
  ): void {}
  removeEventListener?(
    type: string,
    listener: EventListenerOrEventListenerObject
  ): void {}
  detectFaces = jest.fn(
    async (videoInput: VideoInput, type: string, fs: number) => {
      // For testing the "face detection" branch, we simulate a detection.
      const expectedROI: ROI = {
        x0: Math.round(0.1 * 640),
        y0: Math.round(0.1 * 480),
        x1: Math.round(0.4 * 640),
        y1: Math.round(0.4 * 480),
      };
      // Also supply a probeInfo similar to what FFmpeg returns.
      const probeInfo: VideoProbeResult = {
        totalFrames: 20,
        fps: 10,
        width: 640,
        height: 480,
        codec: 'h264',
        bitrate: 1000,
        rotation: 0,
        issues: false,
      };
      // You could return multiple detections if desired. Here we return one.
      return { detections: Array(20).fill(expectedROI), probeInfo };
    }
  );
}

// Dummy options and method config.
const dummyOptions: VitalLensOptions = {
  method: 'pos',
  fDetFs: 1.0,
};
const dummyMethodConfig: MethodConfig = {
  method: 'pos',
  fpsTarget: 5,
  roiMethod: 'face',
  maxWindowLength: 3,
  minWindowLength: 1,
  inputSize: 224,
  requiresState: false,
};

const dummyVideoInput: VideoInput = 'test.mp4';

jest.mock('../../src/utils/faceOps', () => ({
  ...jest.requireActual('../../src/utils/faceOps'),
  getROIForMethod: jest.fn(
    (face: any, methodConfig: any, dims: any, flag: boolean) => face
  ),
}));

describe('extractRGBForROI', () => {
  it('should compute average color over a ROI in a small image', () => {
    // Create a 4x4 image with predictable pixel values.
    const width = 4;
    const height = 4;
    const frameData = new Uint8Array([
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 20, 30, 10, 20, 30, 0, 0,
      0, 0, 0, 0, 10, 20, 30, 10, 20, 30, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0,
    ]);
    const roi = { x0: 1, y0: 1, x1: 3, y1: 3 }; // a 2x2 region
    const [r, g, b] = extractRGBForROI(frameData, width, height, roi);
    // All pixels in the ROI are [10,20,30], so the average is the same.
    expect(r).toBe(10);
    expect(g).toBe(20);
    expect(b).toBe(30);
  });

  it('should return [0,0,0] for an empty ROI', () => {
    const width = 4;
    const height = 4;
    const frameData = new Uint8Array(width * height * 3).fill(255);
    const roi = { x0: 5, y0: 5, x1: 6, y1: 6 }; // ROI completely outside bounds
    const [r, g, b] = extractRGBForROI(frameData, width, height, roi);
    expect(r).toBe(0);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });
});

describe('FileRGBIterator', () => {
  let ffmpegWrapper: DummyFFmpegWrapper;
  let faceDetectionWorker: DummyFaceDetectionWorker;
  let iterator: FileRGBIterator;

  beforeEach(() => {
    ffmpegWrapper = new DummyFFmpegWrapper();
    faceDetectionWorker = new DummyFaceDetectionWorker();
    iterator = new FileRGBIterator(
      dummyVideoInput,
      dummyOptions,
      dummyMethodConfig,
      faceDetectionWorker,
      ffmpegWrapper
    );
  });

  describe('start', () => {
    it('should throw if called with invalid probe info (no face detection worker)', async () => {
      // Create an iterator without a face detection worker.
      const iteratorNoFace = new FileRGBIterator(
        dummyVideoInput,
        dummyOptions,
        dummyMethodConfig,
        null,
        ffmpegWrapper
      );
      // Force probeVideo to return null.
      ffmpegWrapper.probeVideo = jest.fn(
        async (videoInput: VideoInput) => null as any
      );
      await expect(iteratorNoFace.start()).rejects.toThrow(
        'Failed to retrieve video probe information'
      );
    });

    it('should initialize roi and compute rgb when no face detection worker is provided (using globalRoi)', async () => {
      // Create an iterator without a face detection worker.
      dummyOptions.globalRoi = {
        x0: Math.round(0.2 * 640),
        y0: Math.round(0.2 * 480),
        x1: Math.round(0.6 * 640),
        y1: Math.round(0.6 * 480),
      };
      const iteratorNoFace = new FileRGBIterator(
        dummyVideoInput,
        dummyOptions,
        dummyMethodConfig,
        null,
        ffmpegWrapper
      );
      await iteratorNoFace.start();
      const expectedAbsoluteROI = {
        x0: Math.round(0.2 * 640),
        y0: Math.round(0.2 * 480),
        x1: Math.round(0.6 * 640),
        y1: Math.round(0.6 * 480),
      };
      // In the "global ROI" branch, roi is initialized as an array of length equal to totalFrames.
      expect(iteratorNoFace['roi'].length).toBe(20);
      // Each ROI should equal the provided globalRoi.
      iteratorNoFace['roi'].forEach((r: ROI) => {
        expect(r).toEqual(expectedAbsoluteROI);
      });
      // Also, rgb should be computed.
      expect(iteratorNoFace['rgb']).not.toBeNull();
      // Verify that readVideo was called
      expect(ffmpegWrapper.readVideo).toHaveBeenCalled();
    });

    it('should initialize roi and compute rgb when face detection worker is provided', async () => {
      await iterator.start();
      const expectedAbsoluteROI = {
        x0: Math.round(0.1 * 640),
        y0: Math.round(0.1 * 480),
        x1: Math.round(0.4 * 640),
        y1: Math.round(0.4 * 480),
      };
      // In the "global ROI" branch, roi is initialized as an array of length equal to totalFrames.
      expect(iterator['roi'].length).toBe(20);
      // Each ROI should equal the provided globalRoi.
      iterator['roi'].forEach((r: ROI) => {
        expect(r).toEqual(expectedAbsoluteROI);
      });
    });

    it('should initialize roi and rgb data', async () => {
      await iterator.start();
      // With dummyOptions.globalRoi undefined, it should go through face detection.
      const expectedAbsoluteROI = {
        x0: Math.round(0.1 * 640),
        y0: Math.round(0.1 * 480),
        x1: Math.round(0.4 * 640),
        y1: Math.round(0.4 * 480),
      };
      // The iterator should have one ROI per frame (20 frames).
      expect((iterator as any)['roi'].length).toBe(20);
      (iterator as any)['roi'].forEach((r: ROI) => {
        expect(r).toEqual(expectedAbsoluteROI);
      });
      // Also, rgb should be computed.
      expect((iterator as any)['rgb']).not.toBeNull();
      // Verify that readVideo was called
      expect(ffmpegWrapper.readVideo).toHaveBeenCalled();
    });
  });

  describe('next', () => {
    it('should return a Frame with correct properties from next()', async () => {
      // Start the iterator.
      await iterator.start();
      // Now call next()
      const frame = await iterator.next();
      expect(frame).not.toBeNull();
      expect(frame!.getTimestamp().length).toEqual(3);
      expect(frame!.getShape()).toEqual([3, 3]);
      expect(frame!.getROI().length).toEqual(frame!.getTimestamp().length);
    });

    it('should eventually return null when no frames remain', async () => {
      await iterator.start();
      // Consume all frames.
      let frame: Frame | null = null;
      let count = 0;
      do {
        frame = await iterator.next();
        count++;
      } while (frame !== null);
      expect(count).toBeGreaterThanOrEqual(1);
    });

    it('should throw error in next() if probe information not available', async () => {
      await expect(iterator.next()).rejects.toThrow(
        /Probe information is not available/
      );
    });
  });
});
