import { VitalLensResult } from "./core";

export interface IVitalLensController {
  addStream(stream: MediaStream): Promise<void>;
  processFile(filePath: string): Promise<VitalLensResult[]>;
  start(): void;
  pause(): void;
  stop(): void;
  addEventListener(event: string, listener: (data: any) => void): void;
}
