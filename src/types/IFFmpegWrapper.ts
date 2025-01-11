import { VideoInput, VideoProbeResult } from "./core";
import { VideoProcessingOptions } from "./VideoProcessingOptions";

export interface IFFmpegWrapper {
  init(): Promise<void>;
  probeVideo(input: VideoInput): Promise<VideoProbeResult>;
  readVideo(input: VideoInput, options?: VideoProcessingOptions): Promise<Uint8Array | Buffer>;
}