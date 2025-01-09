import { VitalLensResult } from "./core";

export interface IVitalLensController {
  addStream(stream: MediaStream, videoElement?: HTMLVideoElement): Promise<void>;
  stop(): void;
  processFile(filePath: string): Promise<VitalLensResult[]>;
  processBuffer(): Promise<void>;
  addEventListener(event: string, callback: (data: any) => void): void;
}