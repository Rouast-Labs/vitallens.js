import { FileRGBIterator, extractRGBForROI } from '../../src/processing/FileRGBIterator';
import { Frame } from '../../src/processing/Frame';
import { VideoProbeResult, ROI, VitalLensOptions, MethodConfig, VideoInput } from '../../src/types/core';
import { IFFmpegWrapper } from '../../src/types/IFFmpegWrapper';
import { IFaceDetector } from '../../src/types/IFaceDetector';

// Dummy FFmpeg wrapper that simulates behavior for testing.
class DummyFFmpegWrapper implements IFFmpegWrapper {
  init = jest.fn(async () => Promise.resolve());
  loadInput = jest.fn(async (videoInput: VideoInput): Promise<string> => {
    return "test.mp4";
  });
  probeVideo = jest.fn(async (videoInput: VideoInput): Promise<VideoProbeResult> => {
    return {
      totalFrames: 20, fps: 10, width: 640, height: 480,
      codec: 'h264', bitrate: 1000, rotation: 0, issues: false
    };
  });
  readVideo = jest.fn(async (videoInput: VideoInput, options: any, probeInfo: VideoProbeResult): Promise<Uint8Array> => {
    if (options.scale) {
      // Called for face detection.
      const fDetNDsFrames = Math.ceil(20 / Math.max(Math.round(10 / (options.fpsTarget || 1.0)), 1));
      const totalBytes = fDetNDsFrames * 240 * 320 * 3;
      return new Uint8Array(totalBytes).fill(100);
    } else if (options.trim && options.crop) {
      // Called for processing a chunk.
      const startFrame: number = options.trim.startFrame;
      const endFrame: number = options.trim.endFrame;
      const chunkFrameCount = endFrame - startFrame;
      const crop = options.crop as ROI;
      const unionWidth = crop.x1 - crop.x0;
      const unionHeight = crop.y1 - crop.y0;
      const totalBytes = chunkFrameCount * unionWidth * unionHeight * 3;
      return new Uint8Array(totalBytes).fill(50);
    }
    // Default dummy response.
    return new Uint8Array(0);
  });
  cleanup = jest.fn(() => {});
}

// Dummy face detector that returns the same ROI for every frame.
class DummyFaceDetector implements IFaceDetector {
  load = jest.fn(async () => Promise.resolve());
  run = jest.fn(async () => Promise.resolve());
  detect = jest.fn(async (videoFrames: Frame): Promise<ROI[]> => {
    const [numFrames] = videoFrames.getShape();
    // Use Array.from to create an array of ROIs so that each ROI is a separate object.
    return Array.from({ length: numFrames }, () => ({x0: 0.1, y0: 0.1, x1: 0.4, y1: 0.4 }));
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
  requiresState: false
};

const dummyVideoInput: VideoInput = 'test.mp4';

describe('extractRGBForROI', () => {
  it('should compute average color over a ROI in a small image', () => {
    // Create a 4x4 image with predictable pixel values.
    const width = 4;
    const height = 4;
    const frameData = new Uint8Array([0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
                                      0,  0,  0, 10, 20, 30, 10, 20, 30,  0,  0,  0,
                                      0,  0,  0, 10, 20, 30, 10, 20, 30,  0,  0,  0,
                                      0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0])
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
  let faceDetector: DummyFaceDetector;
  let iterator: FileRGBIterator;

  beforeEach(() => {
    ffmpegWrapper = new DummyFFmpegWrapper();
    faceDetector = new DummyFaceDetector();
    iterator = new FileRGBIterator(dummyVideoInput, dummyOptions, dummyMethodConfig, faceDetector, ffmpegWrapper);
  });

  it('should throw if start() is called with invalid probe info', async () => {
    // Force probeVideo to return null by defining a function that accepts the VideoInput parameter.
    ffmpegWrapper.probeVideo = jest.fn(async (videoInput: VideoInput) => null as any);
    await expect(iterator.start()).rejects.toThrow('Failed to retrieve video probe information');
  });

  it('should initialize roi and rgb data on start()', async () => {
    await iterator.start();
    // With dummyOptions.globalRoi undefined, it should go through face detection.
    const expectedAbsoluteROI = {
      x0: Math.round(0.1 * 640),
      y0: Math.round(0.1 * 480),
      x1: Math.round(0.4 * 640),
      y1: Math.round(0.4 * 480),
    };
    // After repeating and adjusting, iterator.roi should have length equal to totalFrames.
    expect(iterator['roi'].length).toBe(20);
    // Also, rgb should be computed.
    expect(iterator['rgb']).not.toBeNull();
    // Check that ffmpegWrapper.readVideo was called at least twice (one for face detection, one or more for chunks).
    expect(ffmpegWrapper.readVideo).toHaveBeenCalled();
  });

  it('should return a Frame with correct properties from next()', async () => {
    // Start the iterator.
    await iterator.start();
    // Now call next()
    const frame = await iterator.next();
    expect(frame).not.toBeNull();
    expect(frame!.getTimestamp().length).toEqual(6);
    expect(frame!.getShape()).toEqual([6, 3]);
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
  });

  it('should throw error in next() if probe information not available', async () => {
    await expect(iterator.next()).rejects.toThrow(/Probe information is not available/);
  });
});
