import { Frame } from "./core";

export interface IFaceDetector {
  init(maxFaces: number, fs: number, scoreThreshold: number, iouThreshold: number): Promise<void>;
  run(inputs: Frame, fps: number, onFinish: (detectionResult: any) => Promise<void>): void;
}
