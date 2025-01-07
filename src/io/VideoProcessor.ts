import ffmpeg from "fluent-ffmpeg";
import { FrameData } from "../types";

export class VideoProcessor {
  async processVideo(filePath: string, outputDir: string): Promise<FrameData[]> {
    return new Promise((resolve, reject) => {
      const frames: FrameData[] = [];
      ffmpeg(filePath)
        .outputOptions(["-vf scale=40:40", "-q:v 2"])
        .on("end", () => resolve(frames))
        .on("error", (err) => reject(err))
        .save(`${outputDir}/frame-%03d.jpg`);
    });
  }
}