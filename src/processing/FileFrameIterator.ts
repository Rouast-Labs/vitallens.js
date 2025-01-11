import { Frame, VideoInput, VitalLensOptions } from '../types/core';
import { FrameIteratorBase } from './FrameIterator.base';
import { IFFmpegWrapper } from '../types/IFFmpegWrapper';
import { MethodConfig } from '../config/methodsConfig';

/**
 * Frame iterator for video files (e.g., local file paths, File, or Blob inputs).
 */
export class FileFrameIterator extends FrameIteratorBase {
  private ffmpeg: IFFmpegWrapper;
  private currentFrameIndex: number = 0;
  private totalFrames: number = 0;

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
    const videoInfo = await this.ffmpeg.probeVideo(this.videoInput);
    this.totalFrames = videoInfo.total_frames;
    // TODO: Determine potential downsampling based on this.options.fps and videoInfo.fps and this.methodConfig.targetFps
  }

  /**
   * Retrieves the next frame from the video file.
   * @returns A promise resolving to the next frame or null if the iterator is closed or EOF is reached.
   */
  // TODO: This needs to be changed. It should load the next chunk of frames
  // - depending on this.methodConfig.minWindowLength and this.methodConfig.maxWindowLength
  async next(): Promise<Frame | null> {
    if (this.isClosed || this.currentFrameIndex >= this.totalFrames) {
      return null;
    }

    const frame = await this.ffmpeg.readFrame(this.videoInput, this.currentFrameIndex, {
      targetFps: this.options.fps,
      crop: this.options.roi,
      pixelFormat: 'rgb24',
    });

    if (!frame) {
      this.stop(); // Stop iterator if EOF is reached
      return null;
    }

    this.currentFrameIndex += 1;

    return {
      data: frame,
      timestamp: (this.currentFrameIndex / this.options.fps) * 1000, // Approximate timestamp
    };
  }

  /**
   * Stops the iterator and releases resources used by the FFmpeg wrapper.
   */
  stop(): void {
    super.stop();
    this.ffmpeg.cleanup();
  }
}
