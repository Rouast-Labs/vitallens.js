import { VideoInput, VideoProbeResult, VideoProcessingOptions } from './core';

export interface IFFmpegWrapper {
  init(): Promise<void>;
  loadInput(input: VideoInput): Promise<string>;
  cleanup(): void;
  probeVideo(input: VideoInput): Promise<VideoProbeResult>;
  readVideo(
    input: VideoInput,
    options: VideoProcessingOptions,
    probeInfo: VideoProbeResult
  ): Promise<Uint8Array>;
}
