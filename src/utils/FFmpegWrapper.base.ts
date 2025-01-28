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
    
    // Parse options
    const dsFactor = (options.fpsTarget && options.fpsTarget < fps) ? Math.round(fps / options.fpsTarget) : 1;
    var targetW = options.crop ? (options.crop.x1 - options.crop.x0) : probeInfo.width;
    var targetH = options.crop ? (options.crop.y1 - options.crop.y0) : probeInfo.height;
    if (options.scale) {
      const preserveAspectRatio = options.preserveAspectRatio || false;
      if (preserveAspectRatio) {
        const scaleRatio = Math.max(options.scale.height, options.scale.width) / Math.max(targetW, targetH);
        targetW = Math.round(targetW * scaleRatio);
        targetH = Math.round(targetH * scaleRatio);
      } else {
        targetW = options.scale.width;
        targetH = options.scale.height;
      }
    }
    
    // Apply trimming
    if (options.trim) {
      const { startFrame, endFrame } = options.trim;
      filters.push(`trim=start_frame=${startFrame}:end_frame=${endFrame}`);
      filters.push("setpts=PTS-STARTPTS");
    }

    // Apply frame downsampling
    if (dsFactor > 1) {
      filters.push(`select='not(mod(n\\,${dsFactor}))'`);
      filters.push("setpts=N/FRAME_RATE/TB");
    }

    // Apply cropping
    if (options.crop) {
      const { x0, y0, x1, y1 } = options.crop;
      filters.push(`crop=${x1 - x0}:${y1 - y0}:${x0}:${y0}`);
    }

    // Apply scaling
    if (options.scale) {
      const scaleAlgorithm = options.scaleAlgorithm || "bicubic";
      filters.push(`scale=${targetW}:${targetH}:flags=${scaleAlgorithm}`);
    }

    return filters;
  }
}
