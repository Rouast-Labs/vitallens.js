import { Vital, VideoInput, VitalLensResult } from './core';

export interface IVitalLensController {
  setVideoStream(
    stream?: MediaStream,
    videoElement?: HTMLVideoElement
  ): Promise<void>;
  startVideoStream(): void;
  pauseVideoStream(): void;
  stopVideoStream(): void;
  setInferenceEnabled(enabled: boolean): void;
  reset(): void;
  processVideoFile(filePath: VideoInput): Promise<VitalLensResult>;
  getSupportedVitals(): Vital[];
  addEventListener(event: string, listener: (data: unknown) => void): void;
  removeEventListener(event: string): void;
  dispose(): Promise<void>;
}
