import { MethodConfig, VideoInput, VitalLensOptions, VideoProbeResult, ROI } from '../types/core';
import { Frame } from './Frame';
import { FrameIteratorBase } from './FrameIterator.base';
import { IFFmpegWrapper } from '../types/IFFmpegWrapper';
import { getROIForMethod, getUnionROI } from '../utils/faceOps';
// import * as tf from '@tensorflow/tfjs';
import { IFaceDetector } from '../types/IFaceDetector';

/**
 * Frame iterator for video files (e.g., local file paths, File, or Blob inputs).
 * Yields 2D `Frame`s representing RGB signal from pre-processed segments of the video file
 */
export class FileRGBIterator extends FrameIteratorBase {
  private ffmpeg: IFFmpegWrapper;
  private currentFrameIndex: number = 0;
  private probeInfo: VideoProbeResult | null = null;
  private fpsTarget: number = 0;
  private dsFactor: number = 0;
  private roi: ROI[] = [];

  constructor(
    private videoInput: VideoInput,
    private options: VitalLensOptions,
    private methodConfig: MethodConfig,
    private faceDetector: IFaceDetector,
    ffmpegWrapper: IFFmpegWrapper
  ) {
    super();
    this.ffmpeg = ffmpegWrapper;
  }

  /**
   * Starts the iterator by initializing the FFmpeg wrapper and probing the video.
   */
  async start(): Promise<void> {
    await this.ffmpeg.init();
    await this.ffmpeg.loadInput(this.videoInput);
    // Probe to get video information
    this.probeInfo = await this.ffmpeg.probeVideo(this.videoInput);
    if (!this.probeInfo) {
      throw new Error('Failed to retrieve video probe information. Ensure the input is valid.');
    }
    // Derive fps target and downsampling factor
    this.fpsTarget = this.options.overrideFpsTarget ? this.options.overrideFpsTarget : this.methodConfig.fpsTarget;
    this.dsFactor = Math.max(Math.round(this.probeInfo.fps / this.fpsTarget), 1);
    if (this.options.globalRoi) {
      this.roi = Array(this.probeInfo.totalFrames).fill(this.options.globalRoi);
    } else {
      const fDetFs = this.options.fDetFs ? this.options.fDetFs : 1.0
      const fDetDsFactor = Math.max(Math.round(this.probeInfo.fps / fDetFs), 1);
      const fDetNDsFrames = Math.ceil(this.probeInfo.totalFrames / fDetDsFactor);
      const video = await this.ffmpeg.readVideo(
        this.videoInput,
        {
          fpsTarget: this.options.fDetFs ? this.options.fDetFs : 1.0,
          scale: { width: 320, height: 240 },
        },
        this.probeInfo
      );
      // Run face detector (nFrames, 4)
      const videoFrames = Frame.fromUint8Array(video, [fDetNDsFrames, 240, 320, 3]);
      const faces = await this.faceDetector.detect(videoFrames) as ROI[];
      // Convert to absolute units
      const absoluteROIs = faces.map(({ x0, y0, x1, y1 }) => ({
        x0: Math.round(x0 * this.probeInfo!.width),
        y0: Math.round(y0 * this.probeInfo!.height),
        x1: Math.round(x1 * this.probeInfo!.width),
        y1: Math.round(y1 * this.probeInfo!.height),
      }));
      // Derive roi from faces (nFrames, 4)
      this.roi = absoluteROIs.map(face => getROIForMethod(face, this.methodConfig, { height: this.probeInfo!.height, width: this.probeInfo!.width }, true));
    }
    // TODO:
    // - Load entire video into memory using union roi (in chunks)
    const unionROI = getUnionROI(this.roi);
    // - Reduce entire video into RGB using progressive different face detections (how to implement?)
  }

  /**
   * Retrieves the next rgb frame from the video file.
   * @returns A promise resolving to the next frame or null if the iterator is closed or EOF is reached.
   */
  async next(): Promise<Frame | null> {
    if (!this.probeInfo) {
      throw new Error('Probe information is not available. Ensure `start()` has been called before `next()`.');
    }

    if (this.isClosed || this.currentFrameIndex >= this.probeInfo.totalFrames) {
      return null;
    }

    const startFrameIndex = Math.max(0, this.currentFrameIndex - this.methodConfig.minWindowLength * this.dsFactor);
    const framesToRead = Math.min(
      this.methodConfig.maxWindowLength * this.dsFactor,
      this.probeInfo.totalFrames - startFrameIndex
    );

    // TODO: Serve the next framesToRead of rgb

    // const tensorData = tidy(() => {
    //   // Convert Uint8Array to Tensor
    //   const shape = [dsFramesExpected, height, width, 3];
    //   return tensor(frameData, shape, 'float32');
    // });

    // TODO: Temp data until we can fix this file
    const dsFramesExpected = 10;

    const mockData = new Uint8Array(224 * 224 * 3).fill(0);

    // Generate timestamps for each frame in the batch
    const frameTimestamps = Array.from({ length: dsFramesExpected }, (_, i) => 
      (startFrameIndex + i) / this.probeInfo!.fps
    );

    return Frame.fromUint8Array(mockData, [1, 224, 224, 3], frameTimestamps);
  }

  /**
   * Stops the iterator and releases resources used by the FFmpeg wrapper.
   */
  stop(): void {
    super.stop();
    this.ffmpeg.cleanup();
  }
}
