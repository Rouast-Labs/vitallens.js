import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";
import { FFmpegWrapperBase } from "./FFmpegWrapper.base";
import { VideoInput, VideoProbeResult, VideoProcessingOptions } from "../types";

export default class FFmpegWrapper extends FFmpegWrapperBase {
  private ffmpeg?: any;
  private loadedFileName: string | null = null;

  /**
   * Initialize the FFmpeg instance for the appropriate environment.
   */
  // Please leave this method as is.
  async init() {
    if (!this.ffmpeg) {
      this.ffmpeg = new FFmpeg();
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
      console.debug("Preparing to load FFmpeg resources...");
      try {
        // Await and log each Blob URL
        const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript");
        console.debug("Core Blob URL:", coreURL);
        const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm");
        console.debug("WASM Blob URL:", wasmURL);
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
        console.debug("FFmpeg loaded successfully.");
      } catch (err) {
        console.error("FFmpeg load error:", err);
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
    const inputName = typeof input === 'string' 
    ? `input_${encodeURIComponent(input)}.mp4` 
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

    this.ffmpeg.writeFile(inputName, data);
    this.loadedFileName = inputName;
    return inputName;
  }

  /**
   * Cleans up the input file from the FFmpeg virtual file system.
   */
  cleanup(): void {
    if (this.loadedFileName) {
      try {
        this.ffmpeg.unlink(this.loadedFileName);
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

    const inputName = await this.loadInput(input);
    const probeOutput = await this.ffmpeg.exec(['-show_streams', '-count_frames', '-pretty', inputName]);
    const videoStream = this.parseVideoStream(probeOutput);

    if (!videoStream) {
      throw new Error('No video streams found in the file.');
    }

    return this.extractMetadata(videoStream);
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
    await this.ffmpeg.exec([
      "-i", inputName,
      ...(filters.length ? ["-vf", filters.join(",")] : []),
      "-pix_fmt", options.pixelFormat || "rgb24",
      "-f", "rawvideo",
      outputName,
    ]);
  
    const output = this.ffmpeg.readFile(outputName);
    this.ffmpeg.unlink(outputName);
    return output;
  }
  
  /**
   * Extracts the metadata from the parsed video stream.
   * @param videoStream - The video stream data.
   * @returns The extracted metadata as a VideoProbeResult object.
   */
  private extractMetadata(videoStream: any): VideoProbeResult {
    let issues = false;

    const fps = this.extractFrameRate(videoStream);
    const duration = parseFloat(videoStream['duration']) || null;

    let totalFrames = parseInt(videoStream['nb_frames'], 10);
    if (isNaN(totalFrames)) {
      issues = true;
      if (fps !== null && duration !== null) {
        console.warn(
          'Number of frames missing. Inferring using duration and fps.'
        );
        totalFrames = Math.round(duration * fps);
      } else {
        console.warn('Cannot infer the total number of frames.');
        totalFrames = 0;
      }
    }

    const width = parseInt(videoStream['width'], 10) || 0;
    const height = parseInt(videoStream['height'], 10) || 0;
    const codec = videoStream['codec_name'] || '';
    const bitrate = parseFloat(videoStream['bit_rate']) / 1000 || 0;

    let rotation = 0;
    if (videoStream['tags']?.rotate) {
      rotation = parseInt(videoStream['tags'].rotate, 10);
    } else if (
      videoStream['side_data_list']?.[0]?.rotation !== undefined
    ) {
      rotation = parseInt(videoStream['side_data_list'][0].rotation, 10);
    }

    if (!issues && totalFrames && fps && duration) {
      const expectedFrames = Math.round(duration * fps);
      if (Math.abs(totalFrames - expectedFrames) > 1) {
        console.warn(
          'Mismatch between the total number of frames and duration/fps information.'
        );
        issues = true;
      }
    }

    return { fps, totalFrames, width, height, codec, bitrate, rotation, issues };
  }

  /**
   * Extracts the frame rate from the video stream.
   * @param videoStream - The video stream data.
   * @returns The frame rate as a number or null if unavailable.
   */
  private extractFrameRate(videoStream: any): number | null {
    try {
      const frameRate = videoStream['avg_frame_rate'];
      if (!frameRate) return null;

      const [numerator, denominator] = frameRate.split('/').map(Number);
      if (denominator === 0) return null;

      return numerator / denominator;
    } catch {
      console.warn('Frame rate information missing.');
      return null;
    }
  }

  /**
   * Parses the video stream information from FFmpeg output.
   * @param output - The FFmpeg probe output.
   * @returns The video stream data or null if no video stream is found.
   */
  private parseVideoStream(output: string): any {
    const streams = output.match(/^\[STREAM\][\s\S]+?\[\/STREAM\]/gm);
    if (!streams) return null;

    for (const stream of streams) {
      if (/codec_type=video/.test(stream)) {
        return this.parseKeyValuePairs(stream);
      }
    }

    return null;
  }

  /**
   * Parses key-value pairs from the FFmpeg output stream.
   * @param section - The FFmpeg output section containing key-value pairs.
   * @returns An object with the parsed key-value pairs.
   */
  private parseKeyValuePairs(section: string): Record<string, any> {
    const lines = section.split('\n');
    const result: Record<string, any> = {};

    for (const line of lines) {
      const [key, value] = line.split('=');
      if (key && value) {
        result[key.trim()] = value.trim();
      }
    }

    return result;
  }
}