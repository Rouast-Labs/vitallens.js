import { FaceDetectorAsync } from './FaceDetectorAsync.browser';
import { Frame } from '../processing/Frame';
import { IFFmpegWrapper } from '../types/IFFmpegWrapper';
import FFmpegWrapper from '../utils/FFmpegWrapper.browser';
import { FaceDetectorInput } from './FaceDetectorAsync.base';
import { VideoProbeResult } from '../types';

const faceDetector = new FaceDetectorAsync();
await faceDetector.load();

let ffmpeg: IFFmpegWrapper | null = null;

// Message handler. We expect the main thread to send an object with:
//   id: a correlation id,
//   dataType: either 'frame' or 'video',
//   data: either a transferable representation of a Frame or a File/Blob,
//   timestamp: optional extra info.
self.onmessage = async (event: MessageEvent) => {
  const { id, data, dataType, timestamp } = event.data;

  try {
    let input: FaceDetectorInput;
    let probeInfo: VideoProbeResult;

    if (dataType === 'video') {
      // Data is a File or Blob. We need to use ffmpeg - init if not already done.
      if (!ffmpeg) {
        ffmpeg = new FFmpegWrapper();
        await ffmpeg.init();
      }
      // Load the input in ffmpeg
      await ffmpeg.loadInput(data);
      // Probe the video to get width and height
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
      ffmpeg ?? undefined,
      probeInfo
    );

    // Convert to absolute coordinates
    const absoluteDets = dets.map(({ x0, y0, x1, y1 }) => ({
      x0: Math.round(x0 * probeInfo.width),
      y0: Math.round(y0 * probeInfo.height),
      x1: Math.round(x1 * probeInfo.width),
      y1: Math.round(y1 * probeInfo.height),
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
