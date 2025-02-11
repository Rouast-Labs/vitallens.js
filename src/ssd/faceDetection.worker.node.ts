import { parentPort } from 'worker_threads';
import { FaceDetectorAsync } from './FaceDetectorAsync.node';
import { Frame, FrameTransferable } from '../processing/Frame';
import { IFFmpegWrapper } from '../types/IFFmpegWrapper';
import FFmpegWrapper from '../utils/FFmpegWrapper.node';
import { FaceDetectorInput } from './FaceDetectorAsync.base';
import { VideoInput, VideoProbeResult } from '../types';

(async () => {
  if (!parentPort) {
    throw new Error('This module should be run as a worker thread.');
  }

  // Create and load the face detector instance.
  const faceDetector = new FaceDetectorAsync();
  await faceDetector.load();

  let ffmpeg: IFFmpegWrapper | null = null;

  // Listen for messages from the parent thread.
  parentPort.on('message', async (event: unknown) => {
    // If you're using strict types, you may cast event as needed.
    const { id, data, dataType, timestamp } = event as {
      id: number;
      data: FaceDetectorInput;
      dataType: 'video' | 'frame';
      timestamp?: number;
    };

    try {
      let input: FaceDetectorInput;
      let probeInfo: VideoProbeResult;

      if (dataType === 'video') {
        // Data is a File or Blob; use FFmpeg to read the video.
        if (!ffmpeg) {
          ffmpeg = new FFmpegWrapper();
          await ffmpeg.init();
        }
        await ffmpeg.loadInput(data as VideoInput);
        probeInfo = await ffmpeg.probeVideo(data as VideoInput);
        input = data; // pass the raw video input
      } else if (dataType === 'frame') {
        // Data is a transferable representation of a Frame.
        input = Frame.fromTransferable(data as unknown as FrameTransferable);
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

      // Run face detection.
      const dets = await faceDetector.detect(
        input,
        ffmpeg ?? undefined,
        probeInfo
      );

      // Convert normalized detections to absolute coordinates.
      const absoluteDets = dets.map(({ x0, y0, x1, y1 }) => ({
        x0: Math.round(x0 * probeInfo.width),
        y0: Math.round(y0 * probeInfo.height),
        x1: Math.round(x1 * probeInfo.width),
        y1: Math.round(y1 * probeInfo.height),
      }));

      // Post the results back to the parent.
      parentPort!.postMessage({
        id,
        detections: absoluteDets,
        probeInfo,
        timestamp,
      });

      // Cleanup: if input was a Frame, release it.
      if (input instanceof Frame) input.release();
      if (ffmpeg) ffmpeg.cleanup();
    } catch (error) {
      parentPort!.postMessage({
        id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
})();
