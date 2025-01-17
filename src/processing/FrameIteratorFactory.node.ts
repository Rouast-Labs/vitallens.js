import { FrameIteratorFactoryBase } from './FrameIteratorFactory.base';
import { IFFmpegWrapper } from '../types/IFFmpegWrapper';
import { VitalLensOptions } from '../types/core';
import FFmpegWrapper from '../utils/FFmpegWrapper.node';

/**
 * Node-specific implementation of FrameIteratorFactory.
 */
export class FrameIteratorFactory extends FrameIteratorFactoryBase {
  constructor(options: VitalLensOptions) {
    super(options);
  }

  /**
   * Provides the Node.js-specific FFmpeg wrapper.
   * @returns An instance of FFmpegWrapperNode.
   */
  protected getFFmpegWrapper(): IFFmpegWrapper {
    return new FFmpegWrapper();
  }
}
