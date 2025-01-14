import { Frame, VideoInput, VitalLensOptions, VideoProbeResult, ROI } from '../types/core';
import { FrameIteratorBase } from './FrameIterator.base';
import { IFFmpegWrapper } from '../types/IFFmpegWrapper';
import { MethodConfig } from '../config/methodsConfig';
import { tidy, tensor } from '@tensorflow/tfjs-core';
import { FaceDetector } from '../ssd/FaceDetector';

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
  private faceDetector: FaceDetector | null = null;
  private roi: ROI[] = [];

  constructor(
    private videoInput: VideoInput,
    private options: VitalLensOptions,
    private methodConfig: MethodConfig,
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
      // TODO: Create roi as (nFrames, 4) by repeating this.options.globalRoi
      this.roi = repeatRoi(this.op);
    } else {
      this.faceDetector = new FaceDetector();
      // TODO: Read downsampled video into memory for face detector
      const video = TODO;
      // TODO: Run face detector
      const faces = this.faceDetector.run(video);
      // TODO: Derive roi from faces
      this.roi = getRoiFromFaceForMethod(faces, method);
    }
    // TODO:
    // - Load entire video into memory using union roi (in chunks)
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
  }

  /**
   * Stops the iterator and releases resources used by the FFmpeg wrapper.
   */
  stop(): void {
    super.stop();
    this.ffmpeg.cleanup();
  }
}
