import { VideoInput } from "./core";
import { VideoProcessingOptions } from "./VideoProcessingOptions";

export interface IFFmpegWrapper {
  init(): Promise<void>;
  readVideo(input: VideoInput, options?: VideoProcessingOptions): Promise<Uint8Array | Buffer>;
}