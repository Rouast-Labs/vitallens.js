import { MethodConfig } from '../config/methodsConfig';
import { VideoInput } from './core';
import { IFrameIterator } from '../processing/FrameIterator.base';

export interface IFrameIteratorFactory {
  createStreamFrameIterator(
    stream?: MediaStream, 
    videoElement?: HTMLVideoElement
  ): IFrameIterator;
  createFileFrameIterator(
    videoInput: VideoInput,
    methodConfig: MethodConfig
  ): IFrameIterator;
}
