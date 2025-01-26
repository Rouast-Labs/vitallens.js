import { MethodConfig, VitalLensOptions, VideoInput } from '../types/core';
import { IFFmpegWrapper } from '../types/IFFmpegWrapper';
import { IFrameIteratorFactory } from '../types/IFrameIteratorFactory';
import { FileFrameIterator } from './FileFrameIterator';
import { FileRGBIterator } from './FileRGBIterator';
import { StreamFrameIterator } from './StreamFrameIterator';
import { IFrameIterator } from './FrameIterator.base';
import { IFaceDetector } from '../types/IFaceDetector';

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
   * @returns A stream frame iterator.
   */
  createStreamFrameIterator(
    stream?: MediaStream,
    videoElement?: HTMLVideoElement,
  ): IFrameIterator {
    if (!stream && !videoElement) {
      throw new Error('Either a MediaStream or an HTMLVideoElement must be provided.');
    }
    
    return new StreamFrameIterator(stream, videoElement);
  }

  /**
   * Creates a frame iterator for file-based inputs.
   * @param videoInput - The video input to process.
   * @param methodConfig - Method config.
   * @returns A file frame iterator.
   */
  createFileFrameIterator(
    videoInput: VideoInput,
    methodConfig: MethodConfig,
    faceDetector: IFaceDetector,
  ): IFrameIterator {
    const ffmpeg = this.getFFmpegWrapper();
    if (this.options.method === 'vitallens') {
      return new FileFrameIterator(videoInput, this.options, methodConfig, faceDetector, ffmpeg);
    } else {
      return new FileRGBIterator(videoInput, this.options, methodConfig, faceDetector, ffmpeg);
    }
  }
}
