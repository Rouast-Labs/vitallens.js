import { FFmpegWrapperBase } from './FFmpegWrapper.base';
import { VideoInput, VideoProbeResult, VideoProcessingOptions } from '../types';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';

export default class FFmpegWrapper extends FFmpegWrapperBase {
  /**
   * Initializes FFmpeg. For the Node.js implementation, this is a no-op.
   */
  async init(): Promise<void> {
    // No initialization needed for Node.js implementation
  }

  /**
   * Loads the video input file and returns its path.
   * @param input - The video input (file path).
   * @returns The path to the loaded file.
   */
  async loadInput(input: VideoInput): Promise<string> {
    if (typeof input !== 'string') {
      throw new Error(
        'Only file paths are supported for Node.js FFmpegWrapper.'
      );
    }

    if (!fs.existsSync(input)) {
      throw new Error(`File not found: ${input}`);
    }

    return input;
  }

  /**
   * Cleans up any loaded video file reference.
   */
  cleanup(): void {
    // No cleanup needed for Node.js implementation
  }

  /**
   * Probes the video file to extract metadata.
   * @param input - The video input (file path).
   * @returns A promise resolving to metadata about the video.
   */
  async probeVideo(input: VideoInput): Promise<VideoProbeResult> {
    const filePath = await this.loadInput(input);

    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find(
          (stream) => stream.codec_type === 'video'
        );

        if (!videoStream) {
          reject(new Error('No video streams found in the file.'));
          return;
        }

        const fps = this.extractFrameRate(videoStream.avg_frame_rate!);
        const duration = parseFloat(videoStream.duration!) || 0;
        let totalFrames = parseInt(videoStream.nb_frames!, 10);

        if (isNaN(totalFrames)) {
          totalFrames = Math.round(duration * (fps || 0));
        }

        const width = videoStream.width || 0;
        const height = videoStream.height || 0;
        const codec = videoStream.codec_name || '';
        const bitrate = parseFloat(videoStream.bit_rate!) / 1000 || 0;

        let rotation = 0;
        if (videoStream.tags?.rotate) {
          rotation = parseInt(videoStream.tags.rotate, 10);
        } else if (videoStream.rotation) {
          rotation = parseInt(videoStream.rotation as string);
        } else if (videoStream.side_data_list?.[0]?.rotation !== undefined) {
          rotation = parseInt(videoStream.side_data_list[0].rotation, 10);
        }

        resolve({
          fps: fps || 0,
          totalFrames,
          width,
          height,
          codec,
          bitrate,
          rotation,
          issues: false, // Node implementation doesn't infer issues
        });
      });
    });
  }

  /**
   * Reads video frames and applies transformations.
   * @param input - The video input (file path).
   * @param options - Video processing options.
   * @param probeInfo - Video probe information.
   * @returns A promise resolving to a Uint8Array containing processed frame data.
   */
  async readVideo(
    input: VideoInput,
    options: VideoProcessingOptions,
    probeInfo: VideoProbeResult
  ): Promise<Uint8Array> {
    const filePath = await this.loadInput(input);

    const filters = this.assembleVideoFilters(options, probeInfo);

    // Generate a unique temporary filename in the OS temp directory
    const tempFile = path.join(
      os.tmpdir(),
      `vitallens_output_${Date.now()}_${Math.random().toString(36).slice(2)}.rgb`
    );

    return new Promise<Uint8Array>((resolve, reject) => {
      ffmpeg(filePath)
        .outputOptions('-pix_fmt', options.pixelFormat || 'rgb24')
        .outputOptions('-f', 'rawvideo')
        .outputOptions('-vsync', 'passthrough')
        .outputOptions('-frame_pts', 'true')
        .videoFilters(filters)
        .save(tempFile)
        .on('end', () => {
          try {
            const buffer = fs.readFileSync(tempFile);
            try {
              fs.unlinkSync(tempFile);
            } catch (cleanupError) {
              console.error('Error cleaning up temporary file:', cleanupError);
            }
            resolve(new Uint8Array(buffer));
          } catch (readError) {
            reject(readError);
          }
        })
        .on('error', (err) => {
          try {
            fs.unlinkSync(tempFile);
          } catch (cleanupError) {
            console.error(
              'Error cleaning up temporary file after error:',
              cleanupError
            );
          }
          reject(err);
        })
        .run();
    });
  }

  /**
   * Extracts the frame rate from the FFmpeg avg_frame_rate string.
   * @param avgFrameRate - The avg_frame_rate string.
   * @returns The frame rate as a number or null if unavailable.
   */
  private extractFrameRate(avgFrameRate: string): number | null {
    if (!avgFrameRate) return null;

    const [numerator, denominator] = avgFrameRate.split('/').map(Number);
    if (denominator === 0) return null;

    return numerator / denominator;
  }
}
