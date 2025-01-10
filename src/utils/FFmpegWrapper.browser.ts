import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";
import { IFFmpegWrapper } from "../types/IFFmpegWrapper";
import { VideoProcessingOptions } from "../types/VideoProcessingOptions";
import { VideoInput } from "../types";
// import { input } from "@tensorflow/tfjs";

export default class FFmpegWrapper implements IFFmpegWrapper {
  private ffmpeg?: any;

  constructor() {}

  /**
   * Initialize the FFmpeg instance for the appropriate environment.
   */
  async init() {
    if (!this.ffmpeg) {
      this.ffmpeg = new FFmpeg();
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
      console.log("Preparing to load FFmpeg resources...");
      try {
        // Await and log each Blob URL
        const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript");
        console.log("Core Blob URL:", coreURL);
        const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm");
        console.log("WASM Blob URL:", wasmURL);
        // const workerURL = await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, "text/javascript");
        // console.log("Worker Blob URL:", workerURL);
        // Now load FFmpeg with the obtained Blob URLs
        // TODO: Load times out as there is an issue with worker.js
        // https://github.com/ffmpegwasm/ffmpeg.wasm/issues/532
        await this.ffmpeg.load({
          coreURL: coreURL,
          wasmURL: wasmURL,
          // workerURL: workerURL,
          // classWorkerURL: workerURL,
        });
        console.log("FFmpeg loaded successfully.");
      } catch (err) {
        console.error("FFmpeg load error:", err);
        throw err;
      }
    }
  }
  
  /**
   * Read video file and apply transformations.
   *
   * @param input URL or File or Blob representing a video file.
   * @param options Video processing options.
   * @returns Processed video as raw RGB24 buffer.
   */
  async readVideo(input: VideoInput, options: VideoProcessingOptions = {}): Promise<Uint8Array> {
    // Make sure ffmpeg is loaded
    await this.init();

    let data: Uint8Array;

    if (typeof input === "string") {
      // Could be a URL
      data = await fetchFile(input);
    } else if (input instanceof File) {
      // A user-selected File
      const arrayBuffer = await input.arrayBuffer();
      data = new Uint8Array(arrayBuffer);
    } else if (input instanceof Blob) {
      // Could be a generic Blob (not necessarily a File)
      const arrayBuffer = await input.arrayBuffer();
      data = new Uint8Array(arrayBuffer);
    } else {
      throw new Error("Unsupported input type.");
    }

    // Write to FFmpeg virtual FS
    const inputName = "input.mp4";
    this.ffmpeg.writeFile(inputName, data);

    // Build FFmpeg filters
    const filters: string[] = [];
    if (options.crop) {
      const { x, y, width, height } = options.crop;
      filters.push(`crop=${width}:${height}:${x}:${y}`);
    }
    if (options.scale) {
      const { width, height } = options.scale;
      filters.push(`scale=${width}:${height}`);
    }
    const filterString = filters.length > 0 ? ["-vf", filters.join(",")] : [];

    const outputName = "output.rgb";
    await this.ffmpeg.exec([
      "-i", inputName,
      ...filterString,
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
