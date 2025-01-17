import { Frame } from "../processing/Frame";
import { ROI } from "./core";

export interface IFaceDetector {
  detect(inputs: Frame): Promise<ROI[]>;
  run(inputs: Frame, onFinish: (detectionResult: ROI[]) => Promise<void>): void;
}
