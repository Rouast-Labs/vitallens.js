import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";
import { FFmpegWrapperBase } from "./FFmpegWrapper.base";
import { VideoInput, VideoProbeResult, VideoProcessingOptions } from "../types";

// Import the worker bundle as a URL (which will be inlined as a data URI)
import workerBundleDataURI from '../../dist/ffmpeg-worker.bundle.js';

export default class FFmpegWrapper extends FFmpegWrapperBase {
  private ffmpeg?: any;
  private loadedFileName: string | null = null;

  /**
   * Initialize the FFmpeg instance for the appropriate environment.
   */
  async init() {
    if (!this.ffmpeg) {
      this.ffmpeg = new FFmpeg();
      console.debug("Preparing to load FFmpeg resources...");
      try {
        // Await and log each Blob URL
        const coreURL = await toBlobURL("https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js", "text/javascript");
        const wasmURL = await toBlobURL("https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm", "application/wasm");
        // Passing worker bundle to avoid issues: https://github.com/ffmpegwasm/ffmpeg.wasm/issues/532
        const workerURL = this.createWorkerBlobURL(workerBundleDataURI);
        // Now load FFmpeg with the obtained Blob URLs
        await this.ffmpeg.load({
          coreURL: coreURL,
          wasmURL: wasmURL,
          classWorkerURL: workerURL,
        });
        console.debug("FFmpeg loaded successfully.");
      } catch (err) {
        console.error("FFmpeg load error:", err);
        throw err;
      }
    }
  }

  /**
   * Converts a data URI or base64-encoded string of a worker script into a Blob URL.
   * @param dataURI - A string containing either a full data URI or a base64-encoded worker script.
   * @returns A Blob URL string representing the worker script.
   */
  createWorkerBlobURL(dataURI: string): string {
    let encoded = dataURI;
    if (dataURI.startsWith('data:')) {
      const parts = dataURI.split(',');
      if (parts.length < 2) {
        throw new Error('Unexpected worker data URI format.');
      }
      encoded = parts[1];
    }
    const workerScript = atob(encoded);
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    return URL.createObjectURL(blob);
  }

  /**
   * Loads the video input into the FFmpeg virtual file system.
   * @param input - The video input (URL, File, or Blob).
   * @returns The virtual file name used for the input.
   */
  async loadInput(input: VideoInput): Promise<string> {
    const inputName = typeof input === 'string' 
      ? `input_${encodeURIComponent(input.replace(/\.mp4$/, ''))}.mp4` 
      : 'input.mp4';

    if (this.loadedFileName === inputName) {
      // Skip re-loading if already loaded
      return inputName;
    }

    let data: Uint8Array;
    if (typeof input === 'string') {
      data = await fetchFile(input);
    } else if (input instanceof File || input instanceof Blob) {
      const arrayBuffer = await input.arrayBuffer();
      data = new Uint8Array(arrayBuffer);
    } else {
      throw new Error('Unsupported input type.');
    }

    await this.ffmpeg.writeFile(inputName, data);
    this.loadedFileName = inputName;
    return inputName;
  }

  /**
   * Cleans up the input file from the FFmpeg virtual file system.
   */
  cleanup(): void {
    if (this.loadedFileName) {
      try {
        this.ffmpeg.deleteFile(this.loadedFileName);
        this.loadedFileName = null;
      } catch (err) {
        console.error('Failed to cleanup input file:', err);
      }
    }
  }

  /**
   * Probes the video file to extract metadata.
   * @param input - The video input (URL, File, or Blob).
   * @returns A promise resolving to metadata about the video.
   */
  async probeVideo(input: VideoInput): Promise<VideoProbeResult> {
    await this.init();
  
    // Load the file into MEMFS and get its virtual filename.
    const inputName = await this.loadInput(input);

    // We'll capture log messages in an array.
    const logLines: string[] = [];

    // Register a temporary log handler.
    const logHandler = (log: { type: string; message: string }) => {
      // You can filter by type if needed (e.g. "stderr" vs. "stdout")
      logLines.push(log.message);
    };
    this.ffmpeg.on("log", logHandler);

    // Run a probe command.
    // This command simply causes ffmpeg to output the file information without trying to produce an output file.
    await this.ffmpeg.exec(["-hide_banner", "-i", inputName]);

    // Remove the temporary log handler.
    this.ffmpeg.off("log", logHandler);

    // Combine the log lines into one string for parsing.
    const output = logLines.join("\n");

    // Parse the output.
    const metadata = this.parseFFmpegOutput(output);
    if (!metadata) {
      throw new Error("Failed to extract metadata from ffmpeg output.");
    }
    return metadata;
  }

  /**
   * Reads video frames and applies transformations.
   * @param input URL or File or Blob representing a video file.
   * @param options - Video processing options.
   * @param probeInfo - Video probe information.
   * @returns A promise resolving to a Uint8Array containing processed video as raw RGB24 buffer.
   */
  async readVideo(
    input: VideoInput,
    options: VideoProcessingOptions,
    probeInfo: VideoProbeResult
  ): Promise<Uint8Array> {
    await this.init();
    const inputName = await this.loadInput(input);
  
    const filters = this.assembleVideoFilters(options, probeInfo);
  
    const outputName = "output.rgb";
    const ret = await this.ffmpeg.exec([
      "-i", inputName,
      ...(filters.length ? ["-vf", filters.join(",")] : []),
      "-pix_fmt", options.pixelFormat || "rgb24",
      "-f", "rawvideo",
      outputName,
    ]);
  
    const output = await this.ffmpeg.readFile(outputName);

    await this.ffmpeg.deleteFile(outputName);
    return output;
  }
  
  /**
   * A helper function that takes ffmpeg log output and extracts metadata.
   *
   * It attempts to parse:
   * - Duration (in the format "Duration: hh:mm:ss.ss")
   * - Video stream details (codec, resolution, and frame rate)
   * - Bitrate (in kb/s)
   *
   * It then infers the total frame count as (duration * fps).
   *
   * @param output - The combined ffmpeg log output.
   * @returns A VideoProbeResult object or null if parsing fails.
   */
  parseFFmpegOutput(output: string): VideoProbeResult | null {
    // Parse Duration: "Duration: 00:00:11.76"
    const durationMatch = output.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
    if (!durationMatch) {
      console.warn("Could not parse duration from ffmpeg output.");
      return null;
    }
    const hours = parseInt(durationMatch[1], 10);
    const minutes = parseInt(durationMatch[2], 10);
    const seconds = parseFloat(durationMatch[3]);
    const duration = hours * 3600 + minutes * 60 + seconds;
  
    // Parse video stream details:
    // Expected pattern example:
    //   "Stream #0:0... Video: h264 (High) (avc1 / 0x31637661), 640x480 ... 30.10 fps"
    const streamRegex = /Stream.*Video:\s*([^,]+).*?,\s*(\d+)x(\d+).*?(\d+(?:\.\d+)?)\s*fps/;
    const streamMatch = output.match(streamRegex);
    if (!streamMatch) {
      console.warn("Could not parse video stream details from ffmpeg output.");
      return null;
    }
    // The full codec string might be something like "h264 (High) (avc1 / 0x31637661)"
    const fullCodec = streamMatch[1].trim();
    // Extract only the first token (e.g., "h264")
    const codec = fullCodec.split(" ")[0];
  
    const width = parseInt(streamMatch[2], 10);
    const height = parseInt(streamMatch[3], 10);
    const fps = parseFloat(streamMatch[4]);
  
    // Parse bitrate if available (e.g., "bitrate: 13055 kb/s")
    const bitrateMatch = output.match(/bitrate:\s*(\d+)\s*kb\/s/);
    const bitrate = bitrateMatch ? parseInt(bitrateMatch[1], 10) : 0;
  
    // Infer total frames based on duration and fps.
    const totalFrames = Math.round(duration * fps);
  
    // Rotation is not available from this output; default to 0.
    const rotation = 0;
  
    // Flag indicating potential issues (if values had to be inferred, etc.)
    const issues = false;
  
    return {
      fps,
      totalFrames,
      width,
      height,
      codec,
      bitrate,
      rotation,
      issues,
    };
  }  
}