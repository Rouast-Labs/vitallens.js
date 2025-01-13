import { IFFmpegWrapper } from "../types/IFFmpegWrapper";
import { VideoProcessingOptions, VideoProbeResult, VideoInput } from "../types";

/**
 * Base class for FFmpegWrapper
 * Contains shared functionality for FFmpeg processing.
 */
export abstract class FFmpegWrapperBase implements IFFmpegWrapper {
  /**
   * Initializes the FFmpeg instance.
   * Platform-specific implementations must override this method.
   */
  abstract init(): Promise<void>;

  /**
   * Loads the video input into the FFmpeg virtual file system.
   * Platform-specific implementations must override this method.
   */
  abstract loadInput(input: VideoInput): Promise<string>;

  /**
   * Cleans up the input file from the FFmpeg virtual file system.
   * Platform-specific implementations must override this method.
   */
  abstract cleanup(): void;

  /**
   * Probes the video file to extract metadata.
   * Platform-specific implementations must override this method.
   */
  abstract probeVideo(input: VideoInput): Promise<VideoProbeResult>;

  /**
   * Reads video data and applies processing options.
   * Platform-specific implementations must override this method.
   */
  abstract readVideo(
    input: VideoInput,
    options: VideoProcessingOptions,
    probeInfo: VideoProbeResult
  ): Promise<Uint8Array>;

  /**
   * Assembles video processing filters for FFmpeg.
   * Handles frame downsampling, temporal trimming, spatial cropping, and scaling.
   *
   * @param options - Video processing options.
   * @param probeInfo - Metadata about the video (e.g., FPS, dimensions).
   * @returns Filters array.
   */
  protected assembleVideoFilters(
    options: VideoProcessingOptions,
    probeInfo: VideoProbeResult
  ): string[] {
    const filters: string[] = [];
    const { fps } = probeInfo;

    // Apply trimming
    if (options.trim) {
      const { startFrame, endFrame } = options.trim;
      filters.push(`trim=start_frame=${startFrame}:end_frame=${endFrame}`);
      filters.push("setpts=PTS-STARTPTS");
    }

    // Apply frame downsampling
    if (options.fpsTarget && fps) {
      const dsFactor = Math.round(fps / options.fpsTarget);
      if (dsFactor > 1) {
        filters.push(`select='not(mod(n\\,${dsFactor}))'`);
        filters.push("setpts=N/FRAME_RATE/TB");
      }
    }

    // Apply cropping
    if (options.crop) {
      const { x, y, width, height } = options.crop;
      filters.push(`crop=${width}:${height}:${x}:${y}`);
    }

    // Apply scaling
    if (options.scale) {
      const { width, height } = options.scale;
      filters.push(`scale=${width}:${height}`);
    }

    return filters;
  }
}
