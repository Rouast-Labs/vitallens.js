import { FrameData } from "../types";

export interface MethodBase {
  estimateVitals(frames: FrameData[]): Promise<{ [key: string]: any }>;
}
