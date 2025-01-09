import fluentFFmpeg from "fluent-ffmpeg";
import { IFFmpegWrapper } from "../types/IFFmpegWrapper";

interface VideoProcessingOptions {
  targetFps?: number; // Downsample frames to this FPS
  crop?: { x: number; y: number; width: number; height: number }; // Crop coordinates
  scale?: { width: number; height: number }; // Resize dimensions
  trim?: { startFrame: number; endFrame: number }; // Frame range for trimming
  pixelFormat?: string; // Pixel format (default: rgb24)
  scaleAlgorithm?: "bicubic" | "bilinear" | "area" | "lanczos"; // Scaling algorithm
}

class FFmpegWrapper implements IFFmpegWrapper {
  private ffmpeg?: any;

  constructor() {}

  /**
   * Initialize the FFmpeg instance for the appropriate environment.
   */
  async init() {
    // const version = fluentFFmpeg.version();
    // console.log("Node.js FFmpeg initialized:", version);
  }

  /**
   * Read video file and apply transformations.
   *
   * @param filePath Path to the video file.
   * @param options Video processing options.
   * @returns Processed video as raw RGB24 buffer.
   */
  async readVideo(filePath: string, options: VideoProcessingOptions = {}): Promise<Uint8Array | Buffer> {
    const fluentFFmpeg = (await import("fluent-ffmpeg")).default;
    const tmpOutput = "output.rgb";
    const fs = require("fs");

    return new Promise((resolve, reject) => {
      let command = fluentFFmpeg(filePath)
        .outputOptions("-pix_fmt", options.pixelFormat || "rgb24")
        .outputOptions("-f", "rawvideo");

      if (options.crop) {
        const { x, y, width, height } = options.crop;
        command = command.videoFilter(`crop=${width}:${height}:${x}:${y}`);
      }

      if (options.scale) {
        const { width, height } = options.scale;
        command = command.videoFilter(`scale=${width}:${height}`);
      }

      command.save(tmpOutput).on("end", () => {
        const data = fs.readFileSync(tmpOutput);
        fs.unlinkSync(tmpOutput);
        resolve(data);
      }).on("error", reject);
    });
  }
}

export default FFmpegWrapper;
