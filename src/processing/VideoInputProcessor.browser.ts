import { VideoInputProcessorBase } from './VideoInputProcessor.base';
import { IFFmpegWrapper } from '../types/IFFmpegWrapper';
import { VitalLensOptions } from '../types/core';
import { FFmpegWrapper } from '../utils/FFmpegWrapper.browser';

/**
 * Browser-specific implementation of VideoInputProcessor.
 */
export class VideoInputProcessor extends VideoInputProcessorBase {
  constructor(options: VitalLensOptions) {
    super(options);
  }

  /**
   * Provides the browser-specific FFmpeg wrapper.
   * @returns An instance of FFmpegWrapperBrowser.
   */
  protected getFFmpegWrapper(): IFFmpegWrapper {
    return new FFmpegWrapper();
  }
}
