import { FaceDetectorAsync } from './FaceDetectorAsync.browser';
import { Frame } from '../processing/Frame';
import { IFFmpegWrapper } from '../types/IFFmpegWrapper';
import FFmpegWrapper from '../utils/FFmpegWrapper.browser';
import { FaceDetectorInput } from './FaceDetectorAsync.base';
import { VideoProbeResult } from '../types';
import { modelJsonPath, modelBinPath } from './modelAssets';

let faceDetector: FaceDetectorAsync | null = null;
let ffmpeg: IFFmpegWrapper | null = null;
let ffmpegCoreURL: string | undefined;
let ffmpegWasmURL: string | undefined;
let initPromise: Promise<void> | null = null;

self.onmessage = async (event: MessageEvent) => {
  const { id, data, dataType, fs, timestamp, type, baseURL } = event.data;

  if (type === 'init') {
    ffmpegCoreURL = event.data.coreURL;
    ffmpegWasmURL = event.data.wasmURL;
    initPromise = (async () => {
      try {
        const finalJsonUrl = baseURL
          ? new URL(modelJsonPath, baseURL).href
          : undefined;
        const finalBinUrl = baseURL
          ? new URL(modelBinPath, baseURL).href
          : undefined;
        faceDetector = new FaceDetectorAsync(
          1,
          0.5,
          0.3,
          finalJsonUrl,
          finalBinUrl
        );
        await faceDetector.load();
      } catch (err) {
        console.error('Worker init error:', err);
      }
    })();
    await initPromise;
    return;
  }

  try {
    if (initPromise) {
      await initPromise;
    }

    let input: FaceDetectorInput;
    let probeInfo: VideoProbeResult;

    if (!faceDetector) {
      throw new Error(
        'Face detection model is not loaded. Call .load() first.'
      );
    }

    if (dataType === 'video') {
      // Data is a File or Blob. We need to use ffmpeg - init if not already done.
      if (!ffmpeg) {
        // Pass the received URLs to the wrapper's constructor
        ffmpeg = new FFmpegWrapper(ffmpegCoreURL, ffmpegWasmURL);
        await ffmpeg.init();
      }
      // Load the input in ffmpeg
      await ffmpeg.loadInput(data);
      // Probe the video
      probeInfo = await ffmpeg.probeVideo(data);
      input = data;
    } else if (dataType === 'frame') {
      // Data is a transferable representation of a Frame. Always a single RGB frame.
      input = Frame.fromTransferable(data);
      probeInfo = {
        fps: 0,
        totalFrames: 1,
        width: input.getShape()[1],
        height: input.getShape()[0],
        codec: 'raw',
        bitrate: 0,
        rotation: 0,
        issues: false,
      };
      input.retain();
    } else {
      throw new Error('Unknown data type provided to the worker.');
    }

    // Run face detection
    const dets = await faceDetector.detect(
      input,
      fs,
      ffmpeg ?? undefined,
      probeInfo
    );

    // Create effective width and height (w, h) based on probeInfo.
    let w = probeInfo.width;
    let h = probeInfo.height;
    const absRotation = Math.abs(probeInfo.rotation);
    if (absRotation === 90) {
      // Swap width and height if rotated 90 degrees.
      [w, h] = [h, w];
    } else if (absRotation !== 0) {
      throw new Error(`Unsupported rotation angle: ${probeInfo.rotation}`);
    }

    // Convert to absolute coordinates
    const absoluteDets = dets.map(({ x0, y0, x1, y1, confidence }) => ({
      x0: Math.round(x0 * w),
      y0: Math.round(y0 * h),
      x1: Math.round(x1 * w),
      y1: Math.round(y1 * h),
      confidence: confidence ?? 1.0,
    }));

    // Return the detections along with any additional info.
    self.postMessage({
      id,
      detections: absoluteDets,
      probeInfo,
      timestamp,
    });

    // Cleanup
    if (input instanceof Frame) input.release();
    if (ffmpeg) ffmpeg.cleanup();
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export {};
