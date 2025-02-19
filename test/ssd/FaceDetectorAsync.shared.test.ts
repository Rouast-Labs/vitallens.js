/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import * as tf from '@tensorflow/tfjs'; // This import will be remapped in Jest config if needed.
import { FaceDetectorAsyncBase } from '../../src/ssd/FaceDetectorAsync.base';
import { Frame } from '../../src/processing/Frame';
import { ROI, VideoInput, VideoProbeResult } from '../../src/types/core';
import { IFFmpegWrapper } from '../../src/types/IFFmpegWrapper';

// Helper to compare ROIs
function areROIsClose(
  received: ROI[],
  expected: ROI[],
  tolerance: number = 1e-6
): boolean {
  return (
    received.length === expected.length &&
    received.every((r, i) => {
      const e = expected[i];
      return (
        Math.abs(r.x0 - e.x0) <= tolerance &&
        Math.abs(r.y0 - e.y0) <= tolerance &&
        Math.abs(r.x1 - e.x1) <= tolerance &&
        Math.abs(r.y1 - e.y1) <= tolerance
      );
    })
  );
}

// --- Mocks for TensorFlow and model files ---
jest.mock('@tensorflow/tfjs', () => {
  const actualTf = jest.requireActual('@tensorflow/tfjs');
  return {
    ...actualTf,
    loadGraphModel: jest.fn(),
    io: {
      ...actualTf.io,
      fromMemory: jest.fn(),
    },
  };
});

jest.mock(
  '../../models/Ultra-Light-Fast-Generic-Face-Detector-1MB/model.json',
  () =>
    'data:application/json;base64,eyJtb2RlbFRvcG9sb2d5Ijp7InNvbWVWYWx1ZSI6MH0sIndlaWdodHNNYW5pZmVzdCI6W3sid2VpZ2h0cyI6W119XX0='
);

jest.mock(
  '../../models/Ultra-Light-Fast-Generic-Face-Detector-1MB/group1-shard1of1.bin',
  () => 'data:application/octet-stream;base64,AAAAAA=='
);

// Create a test subclass to expose the private interpolateDetections method.
class TestFaceDetectorAsync extends FaceDetectorAsyncBase {
  protected async init(): Promise<void> {
    // In tests, the init method may simply load a mock model.
    const modelSource = tf.io.fromMemory({
      modelTopology: {},
      weightSpecs: [],
      weightData: new ArrayBuffer(8),
    });
    this.model = await tf.loadGraphModel(modelSource);
  }

  public testInterpolateDetections(
    detections: any,
    totalFrames: number
  ): ROI[] {
    // @ts-expect-error: accessing private member for testing purposes.
    return this.interpolateDetections(detections, totalFrames);
  }
}

describe('FaceDetectorAsync shared tests', () => {
  let faceDetector: FaceDetectorAsyncBase;

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Create a mock GraphModel that will be used in all tests.
    const mockGraphModel = {
      executeAsync: jest.fn().mockResolvedValue(
        tf.tensor3d([
          [
            [0.1, 0.9, 0.2, 0.2, 0.6, 0.6], // Box 1: [score, class, xMin, yMin, xMax, yMax]
            [0.7, 0.2, 0.3, 0.3, 0.5, 0.5], // Box 2
          ],
        ])
      ),
    } as unknown as tf.GraphModel;

    jest.spyOn(tf.io, 'fromMemory').mockReturnValue('mockedModelSource' as any);
    jest.spyOn(tf, 'loadGraphModel').mockResolvedValue(mockGraphModel);

    // Instantiate your FaceDetectorAsyncBase (or subclass) with desired parameters.
    faceDetector = new TestFaceDetectorAsync(1, 0.5, 0.3);
    await faceDetector.load();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('should initialize the model from memory', async () => {
    expect(tf.io.fromMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        modelTopology: expect.any(Object),
        weightSpecs: expect.any(Array),
        weightData: expect.any(ArrayBuffer),
      })
    );
    expect(tf.loadGraphModel).toHaveBeenCalledWith('mockedModelSource');
  });

  it('should detect a face in a single frame and return ROI', async () => {
    const mockData = new Float32Array(224 * 224 * 3).fill(0);
    const mockTensor = tf.tensor3d(mockData, [224, 224, 3]);
    const frame = Frame.fromTensor(mockTensor, true, [0]);

    const results: ROI[] = await faceDetector.detect(frame);
    const expectedResults = [{ x0: 0.2, y0: 0.2, x1: 0.6, y1: 0.6 }];
    expect(areROIsClose(results, expectedResults)).toBe(true);

    mockTensor.dispose();
    frame.disposeTensor();
  });

  it('should throw an error if the model is not loaded', async () => {
    const uninitializedDetector = new TestFaceDetectorAsync(1, 0.5, 0.3);
    const mockData = new Float32Array(224 * 224 * 3).fill(0);
    const mockTensor = tf.tensor4d(mockData, [1, 224, 224, 3]);
    const frame = Frame.fromTensor(mockTensor, true, [0]);

    (uninitializedDetector as any).model = null;
    await expect(uninitializedDetector.detect(frame)).rejects.toThrow(
      'Face detection model is not loaded. Call .load() first.'
    );
    mockTensor.dispose();
    frame.disposeTensor();
  });

  describe('interpolateDetections', () => {
    it('should interpolate ROIs between detections for unscanned frames', () => {
      const testDetector = new TestFaceDetectorAsync(1, 0.5, 0.3);
      const detections = [
        {
          frameIndex: 0,
          scanned: true,
          faceFound: true,
          interpValid: false,
          confidence: 0.9,
          roi: { x0: 0.1, y0: 0.1, x1: 0.4, y1: 0.4 },
        },
        {
          frameIndex: 10,
          scanned: true,
          faceFound: true,
          interpValid: false,
          confidence: 0.8,
          roi: { x0: 0.5, y0: 0.5, x1: 0.9, y1: 0.9 },
        },
      ];
      const finalROIs = testDetector.testInterpolateDetections(detections, 11);
      expect(finalROIs[0]).toEqual(detections[0].roi);
      expect(finalROIs[10]).toEqual(detections[1].roi);
      const expectedInterp = {
        x0: 0.1 + (0.5 - 0.1) * (5 / 10),
        y0: 0.1 + (0.5 - 0.1) * (5 / 10),
        x1: 0.4 + (0.9 - 0.4) * (5 / 10),
        y1: 0.4 + (0.9 - 0.4) * (5 / 10),
      };
      const tol = 1e-6;
      expect(Math.abs(finalROIs[5].x0 - expectedInterp.x0)).toBeLessThan(tol);
      expect(Math.abs(finalROIs[5].y0 - expectedInterp.y0)).toBeLessThan(tol);
      expect(Math.abs(finalROIs[5].x1 - expectedInterp.x1)).toBeLessThan(tol);
      expect(Math.abs(finalROIs[5].y1 - expectedInterp.y1)).toBeLessThan(tol);
    });
  });

  describe('VideoInput detection with ffmpeg and fs', () => {
    const fakeFfmpeg = {
      readVideo: jest.fn().mockResolvedValue(
        new Uint8Array(3 * 320 * 240 * 3) // 3 frames of 320x240 RGB data.
      ),
    } as unknown as IFFmpegWrapper;

    const fakeProbeInfo: VideoProbeResult = {
      fps: 30,
      totalFrames: 90,
      width: 320,
      height: 240,
      codec: 'h264',
      bitrate: 100000,
      rotation: 0,
      issues: false,
    };

    it('should process a VideoInput using ffmpeg and downsample based on fs', async () => {
      const fakeVideoInput: VideoInput = 'fake/path/to/video.mp4';

      // With fps=30 and fs=1, dsFactor = 30 so scannedFramesCount = Math.ceil(90 / 30) = 3.
      const mockTensorOutput = tf.tensor3d([
        [
          [0.1, 0.9, 0.15, 0.15, 0.65, 0.65],
          [0.8, 0.2, 0.2, 0.2, 0.6, 0.6],
        ],
        [
          [0.1, 0.9, 0.15, 0.15, 0.65, 0.65],
          [0.8, 0.2, 0.2, 0.2, 0.6, 0.6],
        ],
        [
          [0.1, 0.9, 0.15, 0.15, 0.65, 0.65],
          [0.8, 0.2, 0.2, 0.2, 0.6, 0.6],
        ],
      ]);
      const mockGraphModel = {
        executeAsync: jest.fn().mockResolvedValue(mockTensorOutput),
      } as unknown as tf.GraphModel;
      (faceDetector as any).model = mockGraphModel;

      const results: ROI[] = await faceDetector.detect(
        fakeVideoInput,
        fakeFfmpeg,
        fakeProbeInfo
      );
      const expectedROI = { x0: 0.15, y0: 0.15, x1: 0.65, y1: 0.65 };
      expect(results).toHaveLength(fakeProbeInfo.totalFrames);
      for (const roi of results) {
        expect(Math.abs(roi.x0 - expectedROI.x0)).toBeLessThan(1e-6);
        expect(Math.abs(roi.y0 - expectedROI.y0)).toBeLessThan(1e-6);
        expect(Math.abs(roi.x1 - expectedROI.x1)).toBeLessThan(1e-6);
        expect(Math.abs(roi.y1 - expectedROI.y1)).toBeLessThan(1e-6);
      }
      mockTensorOutput.dispose();
    });
  });
});
