/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { FileFrameIterator } from '../../src/processing/FileFrameIterator';
import { Frame } from '../../src/processing/Frame';
import {
  VideoProbeResult,
  ROI,
  VitalLensOptions,
  MethodConfig,
  VideoInput,
} from '../../src/types/core';
import { IFFmpegWrapper } from '../../src/types/IFFmpegWrapper';
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
      const framesToRead = endFrame - startFrame;
      const dsFactor = 2; // our dummy logic assumes dsFactor=2 as computed from probeInfo.fps (10) and fpsTarget (5).
      const dsFramesExpected = Math.ceil(framesToRead / dsFactor);
      const width = options.scale.width;
      const height = options.scale.height;
      const totalPixelsPerFrame = width * height * 3;
      const expectedLength = dsFramesExpected * totalPixelsPerFrame;
      return new Uint8Array(expectedLength).fill(60);
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
  detectFaces = jest.fn(async (videoInput: VideoInput, type: string) => {
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
  });
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
  getRepresentativeROI: jest.fn((rois: ROI[]) => {
    return rois[0];
  }),
}));

describe('FileFrameIterator', () => {
  let ffmpegWrapper: DummyFFmpegWrapper;
  let faceDetectionWorker: DummyFaceDetectionWorker;
  let iterator: FileFrameIterator;

  beforeEach(() => {
    ffmpegWrapper = new DummyFFmpegWrapper();
    faceDetectionWorker = new DummyFaceDetectionWorker();
    iterator = new FileFrameIterator(
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
      const iteratorNoFace = new FileFrameIterator(
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

    it('should initialize roi when no face detection worker is provided (using globalRoi)', async () => {
      // Create an iterator without a face detection worker.
      dummyOptions.globalRoi = {
        x0: Math.round(0.2 * 640),
        y0: Math.round(0.2 * 480),
        x1: Math.round(0.6 * 640),
        y1: Math.round(0.6 * 480),
      };
      const iteratorNoFace = new FileFrameIterator(
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
    });

    it('should initialize roi when face detection worker is provided', async () => {
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
  });

  describe('next', () => {
    it('should return a Frame with correct properties from next()', async () => {
      await iterator.start();
      // Call next() to get a frame.
      const frame = await iterator.next();
      expect(frame).not.toBeNull();
      // With dummy FFmpeg data and the settings:
      // - maxWindowLength: 3, dsFactor: 2 (10fps / 5fps), so 6 frames are read and then downsampled to 3.
      // - inputSize is set so that each frame is 224x224.
      expect(frame!.getShape()).toEqual([3, 224, 224, 3]);
      expect(frame!.getTimestamp().length).toEqual(3);
      expect(frame!.getROI().length).toEqual(3);
    });

    it('should eventually return null when no frames remain', async () => {
      await iterator.start();
      // Consume frames until next() returns null.
      let frame: Frame | null = null;
      let count = 0;
      do {
        frame = await iterator.next();
        count++;
      } while (frame !== null);
      // Ensure that at least one call was made.
      expect(count).toBeGreaterThanOrEqual(1);
    });

    it('should throw error in next() if start() was not called', async () => {
      await expect(iterator.next()).rejects.toThrow(
        /Probe information is not available/
      );
    });
  });
});
