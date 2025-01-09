/**
 * FFmpeg Wrapper for Video Processing
 * 
 * Provides support for both browser and Node.js environments, dynamically choosing
 * between ffmpeg.wasm (browser) and fluent-ffmpeg (Node.js).
 */

interface VideoProcessingOptions {
  targetFps?: number; // Downsample frames to this FPS
  crop?: { x: number; y: number; width: number; height: number }; // Crop coordinates
  scale?: { width: number; height: number }; // Resize dimensions
  trim?: { startFrame: number; endFrame: number }; // Frame range for trimming
  pixelFormat?: string; // Pixel format (default: rgb24)
  scaleAlgorithm?: "bicubic" | "bilinear" | "area" | "lanczos"; // Scaling algorithm
}

class FFmpegWrapper {
  private ffmpeg?: any;
  private isNode: boolean;

  constructor() {
    this.isNode = typeof window === "undefined";
  }

  /**
   * Initialize the FFmpeg instance for the appropriate environment.
   */
  async init() {
    if (this.isNode) {
      // Node.js: Ensure fluent-ffmpeg is available
      const fluentFFmpeg = await import("fluent-ffmpeg");
      // const fluentFFmpeg = (await import("fluent-ffmpeg")) as typeof import("fluent-ffmpeg");
      if (!fluentFFmpeg) {
        throw new Error("fluent-ffmpeg could not be loaded in Node.js");
      }
    } else {
      // Browser: Dynamically import @ffmpeg/ffmpeg
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { toBlobURL } = await import("@ffmpeg/util");
      this.ffmpeg = new FFmpeg();

      if (!this.ffmpeg.loaded) {
        const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
        await this.ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
        });
      }
    }
  }

  /**
   * Read video file and apply transformations.
   *
   * @param filePath Path to the video file.
   * @param options Video processing options.
   * @returns Processed video as raw RGB24 buffer.
   */
  async readVideo(filePath: string, options: VideoProcessingOptions = {}): Promise<Uint8Array | Buffer> {
    if (this.isNode) {
      // Node.js: Use fluent-ffmpeg
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
    } else {
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
}

export default FFmpegWrapper;
