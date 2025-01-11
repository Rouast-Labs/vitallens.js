import { IFFmpegWrapper } from "../types/IFFmpegWrapper";
import { VideoProcessingOptions } from "../types/VideoProcessingOptions";
import { VideoInput } from "../types";
import * as path from "path";

export default class FFmpegWrapper implements IFFmpegWrapper {
  async init() {}

  // TODO: Add probeVideo

  /**
   * Read video file and apply transformations.
   *
   * @param filePath Path to the video file.
   * @param options Video processing options.
   * @returns Processed video as raw RGB24 buffer.
   */
  async readVideo(input: VideoInput, options: VideoProcessingOptions = {}): Promise<Buffer> {
    if (typeof input !== "string") {
      throw new Error("Node FFmpegWrapper only supports string file paths, not File/Blob.");
    }
    
    const fs = require('fs');
    const fluentFFmpeg = (await import("fluent-ffmpeg")).default;
    const tmpOutput = path.join(process.cwd(), "output.rgb");

    return new Promise<Buffer>((resolve, reject) => {
      let command = fluentFFmpeg(input)
        .outputOptions("-pix_fmt", options.pixelFormat || "rgb24")
        .outputOptions("-f", "rawvideo");

      // Crop & scale
      if (options.crop) {
        const { x, y, width, height } = options.crop;
        command = command.videoFilter(`crop=${width}:${height}:${x}:${y}`);
      }
      if (options.scale) {
        const { width, height } = options.scale;
        command = command.videoFilter(`scale=${width}:${height}`);
      }

      command
        .save(tmpOutput)
        .on("end", async () => {
          try {
            const data = fs.readFileSync(tmpOutput);
            fs.unlinkSync(tmpOutput);
            resolve(data); // A Node Buffer
          } catch (err) {
            reject(err);
          }
        })
        .on("error", (err) => reject(err))
        .run();
    });
  }
}

