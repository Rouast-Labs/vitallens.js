import { MethodConfig, VideoInput } from './core';
import { IFrameIterator } from '../processing/FrameIterator.base';
import { IFaceDetector } from './IFaceDetector';

export interface IFrameIteratorFactory {
  createStreamFrameIterator(
    stream?: MediaStream, 
    videoElement?: HTMLVideoElement
  ): IFrameIterator;
  createFileFrameIterator(
    videoInput: VideoInput,
    methodConfig: MethodConfig,
    faceDetector: IFaceDetector,
  ): IFrameIterator;
}
