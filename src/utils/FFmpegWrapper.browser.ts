import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";
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
    this.ffmpeg = new FFmpeg();
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
    await this.ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });
  }

  /**
   * Read video file and apply transformations.
   *
   * @param filePath Path to the video file.
   * @param options Video processing options.
   * @returns Processed video as raw RGB24 buffer.
   */
  async readVideo(filePath: string, options: VideoProcessingOptions = {}): Promise<Uint8Array | Buffer> {
    // Browser: Use ffmpeg.wasm
    await this.init();

    // Load video into FFmpeg virtual filesystem
    const { fetchFile } = await import("@ffmpeg/util");
    const inputName = "input.mp4";
    this.ffmpeg.writeFile(inputName, await fetchFile(filePath));

    // Build FFmpeg filters
    const filters = [];
    if (options.crop) {
      const { x, y, width, height } = options.crop;
      filters.push(`crop=${width}:${height}:${x}:${y}`);
    }
    if (options.scale) {
      const { width, height } = options.scale;
      filters.push(`scale=${width}:${height}`);
    }
    const filterString = filters.length > 0 ? `-vf ${filters.join(",")}` : "";

    const outputName = "output.rgb";
    await this.ffmpeg.exec([
      "-i", inputName,
      ...filterString.split(" "),
      "-pix_fmt", options.pixelFormat || "rgb24",
      "-f", "rawvideo",
      outputName,
    ]);

    const output = this.ffmpeg.readFile(outputName);
    this.ffmpeg.unlink(inputName);
    this.ffmpeg.unlink(outputName);
    return output;
  }
}

export default FFmpegWrapper;
