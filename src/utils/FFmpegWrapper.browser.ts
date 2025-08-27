import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';
import { FFmpegWrapperBase } from './FFmpegWrapper.base';
import { VideoInput, VideoProbeResult, VideoProcessingOptions } from '../types';
import { createWorkerBlobURL } from './workerOps';

// Import the worker bundle as a URL (which will be inlined as a data URI)
import workerBundleDataURI from '../../dist/ffmpeg.worker.bundle.js';

// These global variables will be defined by Rollup's replace plugin during the build process.
declare const SELF_CONTAINED_BUILD: boolean;
declare const IS_WORKER_CONTEXT: boolean;
declare const __FFMPEG_CORE_URL__: string;
declare const __FFMPEG_WASM_URL__: string;

export default class FFmpegWrapper extends FFmpegWrapperBase {
  private ffmpeg?: unknown;
  private loadedFileName: string | null = null;
  private coreURL?: string;
  private wasmURL?: string;

  constructor(coreURL?: string, wasmURL?: string) {
    super();
    this.coreURL = coreURL;
    this.wasmURL = wasmURL;
  }

  /**
   * Initialize the FFmpeg instance for the appropriate environment.
   */
  async init() {
    if (!this.ffmpeg) {
      this.ffmpeg = new FFmpeg();
      try {
        const workerURL = createWorkerBlobURL(workerBundleDataURI);

        // Determine the correct asset URLs based on the build flags and constructor arguments.
        if (this.coreURL && this.wasmURL) {
          // URLs were provided to the constructor (worker in self-contained build). Do nothing.
        } else if (!IS_WORKER_CONTEXT && SELF_CONTAINED_BUILD) {
          // Main thread in a self-contained build: use the injected global variables.
          this.coreURL = __FFMPEG_CORE_URL__;
          this.wasmURL = __FFMPEG_WASM_URL__;
        } else {
          // Standard build (main thread or worker): fetch from CDN.
          this.coreURL = await toBlobURL(
            'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
            'text/javascript'
          );
          this.wasmURL = await toBlobURL(
            'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm',
            'application/wasm'
          );
        }

        // Now load FFmpeg with the obtained URLs
        await (this.ffmpeg as FFmpeg).load({
          coreURL: this.coreURL,
          wasmURL: this.wasmURL,
          classWorkerURL: workerURL,
        });
      } catch (err) {
        console.error('FFmpeg load error:', err);
        throw err;
      }
    }
  }

  /**
   * Loads the video input into the FFmpeg virtual file system.
   * @param input - The video input (URL, File, or Blob).
   * @returns The virtual file name used for the input.
   */
  async loadInput(input: VideoInput): Promise<string> {
    const inputName =
      typeof input === 'string'
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

    await (this.ffmpeg as FFmpeg).writeFile(inputName, data);
    this.loadedFileName = inputName;
    return inputName;
  }

  /**
   * Cleans up the input file from the FFmpeg virtual file system.
   */
  cleanup(): void {
    if (this.loadedFileName) {
      try {
        (this.ffmpeg as FFmpeg).deleteFile(this.loadedFileName);
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
    (this.ffmpeg as FFmpeg).on('log', logHandler);

    // Run a probe command.
    // This command simply causes ffmpeg to output the file information without trying to produce an output file.
    await (this.ffmpeg as FFmpeg).exec(['-hide_banner', '-i', inputName]);

    // Remove the temporary log handler.
    (this.ffmpeg as FFmpeg).off('log', logHandler);

    // Combine the log lines into one string for parsing.
    const output = logLines.join('\n');

    // Parse the output.
    const metadata = this.parseFFmpegOutput(output);
    if (!metadata) {
      throw new Error('Failed to extract metadata from ffmpeg output.');
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

    const outputName = `output_${Date.now()}_${Math.random().toString(36).slice(2)}.rgb`;

    const ret = await (this.ffmpeg as FFmpeg).exec([
      '-i',
      inputName,
      ...(filters.length ? ['-vf', filters.join(',')] : []),
      '-pix_fmt',
      options.pixelFormat || 'rgb24',
      '-f',
      'rawvideo',
      '-vsync',
      'passthrough',
      outputName,
    ]);

    if (ret === 1) {
      throw new Error('FFmpeg execution failed with exit code 1');
    }

    const output = (await (this.ffmpeg as FFmpeg).readFile(
      outputName
    )) as Uint8Array;

    try {
      await (this.ffmpeg as FFmpeg).deleteFile(outputName);
    } catch (cleanupError) {
      console.error('Error cleaning up output file:', cleanupError);
    }

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
      console.warn('Could not parse duration from ffmpeg output.');
      return null;
    }
    const hours = parseInt(durationMatch[1], 10);
    const minutes = parseInt(durationMatch[2], 10);
    const seconds = parseFloat(durationMatch[3]);
    const duration = hours * 3600 + minutes * 60 + seconds;

    // Parse video stream details:
    // Expected pattern example:
    //   "Stream #0:0... Video: h264 (High) (avc1 / 0x31637661), 640x480 ... 30.10 fps"
    const streamRegex =
      /Stream.*Video:\s*([^,]+).*?,\s*(\d+)x(\d+).*?(\d+(?:\.\d+)?)\s*fps/;
    const streamMatch = output.match(streamRegex);
    if (!streamMatch) {
      console.warn('Could not parse video stream details from ffmpeg output.');
      return null;
    }
    // The full codec string might be something like "h264 (High) (avc1 / 0x31637661)"
    const fullCodec = streamMatch[1].trim();
    // Extract only the first token (e.g., "h264")
    const codec = fullCodec.split(' ')[0];

    const width = parseInt(streamMatch[2], 10);
    const height = parseInt(streamMatch[3], 10);
    const fps = parseFloat(streamMatch[4]);

    // Parse bitrate if available (e.g., "bitrate: 13055 kb/s")
    const bitrateMatch = output.match(/bitrate:\s*(\d+)\s*kb\/s/);
    const bitrate = bitrateMatch ? parseInt(bitrateMatch[1], 10) : 0;

    // Parse rotation info (if available)
    // Look for a line like: "displaymatrix: rotation of -90.00 degrees"
    const rotationRegex =
      /displaymatrix:\s*rotation\s*of\s*(-?\d+(?:\.\d+)?)\s*degrees/;
    const rotationMatch = output.match(rotationRegex);
    const rotation = rotationMatch ? parseFloat(rotationMatch[1]) : 0;

    // Infer total frames based on duration and fps.
    const totalFrames = Math.round(duration * fps);

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
