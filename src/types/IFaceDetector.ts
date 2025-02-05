import { FaceDetectorInput } from '../ssd/FaceDetectorAsync.base';
import { ROI, VideoProbeResult } from './core';
import { IFFmpegWrapper } from './IFFmpegWrapper';

export interface IFaceDetector {
  load(): Promise<void>;
  detect(
    input: FaceDetectorInput,
    ffmpeg?: IFFmpegWrapper,
    probeInfo?: VideoProbeResult
  ): Promise<ROI[]>;
  run(
    input: FaceDetectorInput,
    onFinish: (detectionResult: ROI[]) => Promise<void>
  ): void;
}
