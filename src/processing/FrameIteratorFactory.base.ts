import { MethodConfig } from '../config/methodsConfig';
import { Frame, VitalLensOptions, VideoInput } from '../types/core';
import { IFFmpegWrapper } from '../types/IFFmpegWrapper';
import { IFrameIteratorFactory } from '../types/IFrameIteratorFactory';
import { FileFrameIterator } from './FileFrameIterator';
import { StreamFrameIterator } from './StreamFrameIterator';

/**
 * Creates iterators for video processing, including frame capture and preprocessing.
 */
export abstract class FrameIteratorFactoryBase implements IFrameIteratorFactory {
  constructor(private options: VitalLensOptions) {}

  /**
   * Subclasses must return the environment-specific FFmpeg wrapper.
   */
  protected abstract getFFmpegWrapper(): IFFmpegWrapper;

  /**
   * Creates a frame iterator for live streams.
   * @param stream - The MediaStream to process.
   * @param videoElement - Optional video element if the client is already rendering the stream.
   * @param options - Processing options.
   * @returns A stream frame iterator.
   */
  createStreamFrameIterator(
    stream?: MediaStream,
    videoElement?: HTMLVideoElement,
    options?: VitalLensOptions
  ): AsyncIterable<Frame> {
    if (!stream && !videoElement) {
      throw new Error('Either a MediaStream or an HTMLVideoElement must be provided.');
    }
    return new StreamFrameIterator(stream, videoElement, options || this.options);
  }

  /**
   * Creates a frame iterator for file-based inputs.
   * @param videoInput - The video input to process.
   * @param options - Processing options.
   * @param methodConfig - Method config.
   * @returns A file frame iterator.
   */
  createFileFrameIterator(
    videoInput: VideoInput,
    options: VitalLensOptions,
    methodConfig: MethodConfig
  ): AsyncIterable<Frame> {
    const ffmpeg = this.getFFmpegWrapper();
    return new FileFrameIterator(videoInput, options, methodConfig, ffmpeg);
  }
}
