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
import { IFaceDetector } from '../../src/types/IFaceDetector';

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
      if (options.scale && !options.trim && !options.crop) {
        // Called for face detection.
        const fDetFs = options.fpsTarget || 1.0;
        const fDetFactor = Math.max(Math.round(probeInfo.fps / fDetFs), 1);
        const fDetNDsFrames = Math.ceil(probeInfo.totalFrames / fDetFactor);
        const totalBytes = fDetNDsFrames * 240 * 320 * 3;
        return new Uint8Array(totalBytes).fill(100);
      } else if (options.trim && options.crop && options.scale) {
        // Called in FileFrameIterator.next()
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
      // Default dummy response.
      return new Uint8Array(0);
    }
  );
  cleanup = jest.fn(() => {});
}

// Dummy face detector that returns the same ROI for every frame.
class DummyFaceDetector implements IFaceDetector {
  load = jest.fn(async () => Promise.resolve());
  run = jest.fn(async () => Promise.resolve());
  detect = jest.fn(async (videoFrames: Frame): Promise<ROI[]> => {
    const [numFrames] = videoFrames.getShape();
    return Array.from({ length: numFrames }, () => ({
      x0: 0.1,
      y0: 0.1,
      x1: 0.4,
      y1: 0.4,
    }));
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
}));

describe('FileFrameIterator', () => {
  let ffmpegWrapper: DummyFFmpegWrapper;
  let faceDetector: DummyFaceDetector;
  let iterator: FileFrameIterator;

  beforeEach(() => {
    ffmpegWrapper = new DummyFFmpegWrapper();
    faceDetector = new DummyFaceDetector();
    iterator = new FileFrameIterator(
      dummyVideoInput,
      dummyOptions,
      dummyMethodConfig,
      faceDetector,
      ffmpegWrapper
    );
  });

  it('should throw if start() is called with invalid probe info', async () => {
    // Force probeVideo to return null by defining a function that accepts the VideoInput parameter.
    ffmpegWrapper.probeVideo = jest.fn(
      async (videoInput: VideoInput) => null as any
    );
    await expect(iterator.start()).rejects.toThrow(
      'Failed to retrieve video probe information'
    );
  });

  it('should initialize roi on start() when globalRoi is not provided', async () => {
    await iterator.start();
    const expectedAbsoluteROI = {
      x0: Math.round(0.1 * 640),
      y0: Math.round(0.1 * 480),
      x1: Math.round(0.4 * 640),
      y1: Math.round(0.4 * 480),
    };
    // The iterator.roi should have length equal to totalFrames.
    expect(iterator['roi'].length).toBe(20);
    // Check that each ROI matches the expected absolute ROI after getROIForMethod is applied.
    iterator['roi'].forEach((r) => {
      expect(r).toEqual(expectedAbsoluteROI);
    });
  });

  it('should return a Frame with correct properties from next()', async () => {
    await iterator.start();
    // Call next() to get a frame.
    const frame = await iterator.next();
    expect(frame).not.toBeNull();
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
    // Given totalFrames = 20 and our read logic, count should be greater than or equal to the number of calls required.
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('should throw error in next() if start() was not called', async () => {
    await expect(iterator.next()).rejects.toThrow(
      /Probe information is not available/
    );
  });
});
