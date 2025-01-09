import { Frame } from "./core";

export interface IVideoProcessor {
  startStreamCapture(stream: MediaStream, onFrame: (frame: Frame) => void, videoElement?: HTMLVideoElement): void;
  extractFramesFromFile(filePath: string): Promise<Frame[]>;
}