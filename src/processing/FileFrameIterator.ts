import { Frame, VideoInput, VitalLensOptions, VideoProbeResult } from '../types/core';
import { FrameIteratorBase } from './FrameIterator.base';
import { IFFmpegWrapper } from '../types/IFFmpegWrapper';
import { MethodConfig, METHODS_CONFIG } from '../config/methodsConfig';
import { Tensor, tidy, tensor } from '@tensorflow/tfjs-core';

/**
 * Frame iterator for video files (e.g., local file paths, File, or Blob inputs).
 */
export class FileFrameIterator extends FrameIteratorBase {
  private ffmpeg: IFFmpegWrapper;
  private currentFrameIndex: number = 0;
  private probeInfo: VideoProbeResult | null = null;

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
   * Starts the iterator by initializing the FFmpeg wrapper and determining total frames.
   */
  async start(): Promise<void> {
    await this.ffmpeg.init();
    await this.ffmpeg.loadInput(this.videoInput);
    this.probeInfo = await this.ffmpeg.probeVideo(this.videoInput);
    if (!this.probeInfo) {
      throw new Error('Failed to retrieve video probe information. Ensure the input is valid.');
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

    const framesToRead = Math.min(
      this.methodConfig.maxWindowLength,
      this.probeInfo.totalFrames - this.currentFrameIndex
    );

    const frameData = await this.ffmpeg.readVideo(
      this.videoInput,
      {
        fpsTarget: this.options.overrideFpsTarget
        ? this.options.overrideFpsTarget
        : METHODS_CONFIG[this.options.method].fpsTarget,
        crop: this.options.roi,
        scale: this.methodConfig.inputSize
        ? { width: this.methodConfig.inputSize, height: this.methodConfig.inputSize }
        : undefined,
        trim: { startFrame: this.currentFrameIndex, endFrame: this.currentFrameIndex + framesToRead },
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

    const width = this.methodConfig.inputSize || this.options.roi?.width; 
    const height = this.methodConfig.inputSize || this.options.roi?.height;
    if (!width || !height) {
      throw new Error(
        'Unable to determine frame dimensions. Ensure scale or ROI dimensions are provided.'
      );
    }

    const totalPixels = width * height * 3;
    const expectedBufferLength = framesToRead * totalPixels;

    if (frameData.length !== expectedBufferLength) {
      throw new Error(
        `Buffer length mismatch. Expected ${expectedBufferLength}, but received ${frameData.length}.`
      );
    }

    return tidy(() => {
      // Convert Uint8Array to Tensor
      const shape = [framesToRead, height, width, 3];
      return {
        data: tensor(frameData, shape, 'float32'),
        timestamp: //TODO
      }
    });
  }

  /**
   * Stops the iterator and releases resources used by the FFmpeg wrapper.
   */
  stop(): void {
    super.stop();
    this.ffmpeg.cleanup();
  }
}
