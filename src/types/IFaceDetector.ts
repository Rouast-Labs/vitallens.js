import { FaceDetectorInput } from '../ssd/FaceDetectorAsync.base';
import { ROI } from './core';
import { IFFmpegWrapper } from './IFFmpegWrapper';

export interface IFaceDetector {
  load(): Promise<void>;
  detect(input: FaceDetectorInput, ffmpeg?: IFFmpegWrapper): Promise<ROI[]>;
}
