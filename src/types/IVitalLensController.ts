import { VideoInput, VitalLensResult } from "./core";

export interface IVitalLensController {
  addStream(stream?: MediaStream, videoElement?: HTMLVideoElement): Promise<void>;
  processFile(filePath: VideoInput): Promise<VitalLensResult[]>;
  start(): void;
  pause(): void;
  stop(): void;
  addEventListener(event: string, listener: (data: any) => void): void;
}
