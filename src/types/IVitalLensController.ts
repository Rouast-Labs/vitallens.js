import { VideoInput, VitalLensResult } from "./core";

export interface IVitalLensController {
  setVideoStream(stream?: MediaStream, videoElement?: HTMLVideoElement): Promise<void>;
  startVideoStream(): void;
  pauseVideoStream(): void;
  stopVideoStream(): void;
  processVideoFile(filePath: VideoInput): Promise<VitalLensResult>;
  addEventListener(event: string, listener: (data: any) => void): void;
  removeEventListener(event: string): void;
}
