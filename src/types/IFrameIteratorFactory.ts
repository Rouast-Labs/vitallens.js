import { MethodConfig, VideoInput } from './core';
import { IFaceDetector } from './IFaceDetector';
import { IFrameIterator } from './IFrameIterator';

export interface IFrameIteratorFactory {
  createStreamFrameIterator(
    stream?: MediaStream,
    videoElement?: HTMLVideoElement
  ): IFrameIterator;
  createFileFrameIterator(
    videoInput: VideoInput,
    methodConfig: MethodConfig,
    faceDetector: IFaceDetector
  ): IFrameIterator;
}
