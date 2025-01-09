import { VideoProcessorBase } from './VideoProcessor.base';
import { IFFmpegWrapper } from '../types/IFFmpegWrapper';
import FFmpegWrapper from '../utils/FFmpegWrapper.node';

export class VideoProcessor extends VideoProcessorBase {
  protected getFFmpegWrapper(): IFFmpegWrapper {
    return new FFmpegWrapper()
  }
}
