import { FrameIteratorFactoryBase } from './FrameIteratorFactory.base';
import { IFFmpegWrapper } from '../types/IFFmpegWrapper';
import { VitalLensOptions } from '../types/core';
import { FFmpegWrapper } from '../utils/FFmpegWrapper.browser';

/**
 * Browser-specific implementation of FrameIteratorFactory.
 */
export class FrameIteratorFactory extends FrameIteratorFactoryBase {
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
