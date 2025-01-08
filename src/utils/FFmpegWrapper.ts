import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

export class FFmpegWrapper {
  private ffmpeg: FFmpeg;

  constructor() {
    this.ffmpeg = new FFmpeg();
  }

  /**
   * Initializes the FFmpeg instance. Must be called before using other methods.
   */
  async init(): Promise<void> {
    if (!this.ffmpeg.isLoaded()) {
      await this.ffmpeg.load();
    }
  }

  /**
   * Processes a video file and extracts the frames as raw pixel data in memory.
   * Crops to the specified ROI and resizes to target dimensions.
   * @param filePath - Path to the input video file (or Uint8Array in the browser).
   * @param fps - Target frames per second for extraction.
   * @param roi - Region of interest to crop { x, y, width, height }.
   * @returns A Uint8Array containing the video frames as raw pixel data.
   */
  async processVideoToMemory(
    filePath: string | Uint8Array,
    fps: number,
    roi: { x: number; y: number; width: number; height: number }
  ): Promise<Uint8Array> {
    await this.init(); // Ensure FFmpeg is ready

    const inputFileName = 'input.mp4';
    const cropFilter = `crop=${roi.width}:${roi.height}:${roi.x}:${roi.y}`;
    const scaleFilter = `scale=40:40`; // Resize to 40x40 pixels
    const pixFmt = 'rgb24'; // Format for raw RGB data
    const command = ['-i', inputFileName, '-vf', `${cropFilter},${scaleFilter},fps=${fps}`, '-f', 'rawvideo', '-pix_fmt', pixFmt, 'output.raw'];

    // Write the input video file into FFmpeg's virtual filesystem
    if (typeof filePath === 'string') {
      const fs = require('fs');
      const fileData = fs.readFileSync(filePath); // Read file from disk
      await this.ffmpeg.writeFile(inputFileName, fileData);
    } else {
      await this.ffmpeg.writeFile(inputFileName, filePath); // Handle Uint8Array (browser)
    }

    // Execute the FFmpeg command
    await this.ffmpeg.exec(command);

    // Read the output file containing raw video data
    const rawData = await this.ffmpeg.readFile('output.raw');

    // Cleanup temporary files
    await this.ffmpeg.removeFile(inputFileName);
    await this.ffmpeg.removeFile('output.raw');

    return rawData; // Return raw pixel data as Uint8Array
  }
}
