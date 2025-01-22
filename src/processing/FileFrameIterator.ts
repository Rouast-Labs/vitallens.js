import { VideoInput, VitalLensOptions, VideoProbeResult, ROI } from '../types/core';
import { Frame } from './Frame';
import { FrameIteratorBase } from './FrameIterator.base';
import { IFFmpegWrapper } from '../types/IFFmpegWrapper';
import { MethodConfig } from '../config/methodsConfig';
import { getRepresentativeROI, getROIForMethod } from '../utils/faceOps';
import { IFaceDetector } from '../types/IFaceDetector';

/**
 * Frame iterator for video files (e.g., local file paths, File, or Blob inputs).
 * Yields 4D `Frame`s representing pre-processed segments of the video file
 */
export class FileFrameIterator extends FrameIteratorBase {
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
      this.dsFactor = Math.max(Math.round(this.probeInfo.fps / fDetFs), 1);
      const nDsFrames = Math.ceil(this.probeInfo.totalFrames / this.dsFactor);
      const video = await this.ffmpeg.readVideo(
        this.videoInput,
        {
          fpsTarget: this.options.fDetFs ? this.options.fDetFs : 1.0,
          scale: { width: 320, height: 240 },
        },
        this.probeInfo
      );
      // Run face detector (nFrames, 4)
      const videoFrames = Frame.fromUint8Array(video, [nDsFrames, 240, 320, 3]);
      const faces = await this.faceDetector.detect(videoFrames) as ROI[];
      // Convert to absolute units
      const absoluteROIs = faces.map(({ x, y, width: w, height: h }) => ({
        x: Math.round(x * this.probeInfo!.width),
        y: Math.round(y * this.probeInfo!.height),
        width: Math.round(w * this.probeInfo!.width),
        height: Math.round(h * this.probeInfo!.height),
      }));
      // Derive roi from faces (nFrames, 4)
      this.roi = absoluteROIs.map(face => getROIForMethod(face, this.methodConfig, { height: this.probeInfo!.height, width: this.probeInfo!.width }, true));
    }
  }

  /**
   * Retrieves the next frame from the video file.
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

    const roi = getRepresentativeROI(
      this.roi.slice(startFrameIndex, startFrameIndex + framesToRead),
    );

    const frameData = await this.ffmpeg.readVideo(
      this.videoInput,
      {
        fpsTarget: this.fpsTarget,
        crop: roi,
        scale: this.methodConfig.inputSize
        ? { width: this.methodConfig.inputSize, height: this.methodConfig.inputSize }
        : undefined,
        trim: { startFrame: startFrameIndex, endFrame: startFrameIndex + framesToRead },
        pixelFormat: 'rgb24',
        scaleAlgorithm: 'bicubic',
      },
      this.probeInfo
    );

    if (!frameData) {
      this.stop();
      return null;
    }

    this.currentFrameIndex += framesToRead;

    const width = this.methodConfig.inputSize || this.options.globalRoi?.width; 
    const height = this.methodConfig.inputSize || this.options.globalRoi?.height;
    if (!width || !height) {
      throw new Error(
        'Unable to determine frame dimensions. Ensure scale or ROI dimensions are provided.'
      );
    }

    const dsFramesExpected = Math.ceil(framesToRead / this.dsFactor);
    const totalPixelsPerFrame = width * height * 3;
    const expectedBufferLength = dsFramesExpected * totalPixelsPerFrame;

    if (frameData.length !== expectedBufferLength) {
      throw new Error(
        `Buffer length mismatch. Expected ${expectedBufferLength}, but received ${frameData.length}.`
      );
    }

    const shape = [dsFramesExpected, height, width, 3];

    // Generate timestamps for each frame in the batch
    const frameTimestamps = Array.from({ length: dsFramesExpected }, (_, i) => 
      (startFrameIndex + i) / this.probeInfo!.fps
    );

    return Frame.fromUint8Array(frameData, shape, frameTimestamps);
  }

  /**
   * Stops the iterator and releases resources used by the FFmpeg wrapper.
   */
  stop(): void {
    super.stop();
    this.ffmpeg.cleanup();
  }
}
