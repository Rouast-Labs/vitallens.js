import { MethodConfig, VitalLensOptions, VideoInput } from '../types/core';
import { IFFmpegWrapper } from '../types/IFFmpegWrapper';
import { FileFrameIterator } from './FileFrameIterator';
import { FileRGBIterator } from './FileRGBIterator';
import { StreamFrameIterator } from './StreamFrameIterator';
import { IFrameIterator } from '../types/IFrameIterator';
import { IFaceDetectionWorker } from '../types/IFaceDetectionWorker';

/**
 * Creates iterators for video processing, including frame capture and preprocessing.
 */
export class FrameIteratorFactory {
  constructor(
    private options: VitalLensOptions,
    private getConfig: () => MethodConfig
  ) {}

  /**
   * Creates a frame iterator for live streams.
   * @param stream - The MediaStream to process.
   * @param videoElement - Optional video element if the client is already rendering the stream.
   * @returns A stream frame iterator.
   */
  createStreamFrameIterator(
    stream?: MediaStream,
    videoElement?: HTMLVideoElement
  ): IFrameIterator {
    if (!stream && !videoElement) {
      throw new Error(
        'Either a MediaStream or an HTMLVideoElement must be provided.'
      );
    }

    return new StreamFrameIterator(stream, videoElement);
  }

  /**
   * Creates a frame iterator for file-based inputs.
   * @param videoInput - The video input to process.
   * @param ffpmeg - The ffmpeg wrapper.
   * @param faceDetectionWorker - The face detection worker.
   * @returns A file frame iterator.
   */
  createFileFrameIterator(
    videoInput: VideoInput,
    ffmpeg: IFFmpegWrapper,
    faceDetectionWorker: IFaceDetectionWorker | null
  ): IFrameIterator {
    if (this.options.method === 'vitallens') {
      return new FileFrameIterator(
        videoInput,
        this.options,
        this.getConfig,
        faceDetectionWorker,
        ffmpeg
      );
    } else {
      return new FileRGBIterator(
        videoInput,
        this.options,
        this.getConfig,
        faceDetectionWorker,
        ffmpeg
      );
    }
  }
}
