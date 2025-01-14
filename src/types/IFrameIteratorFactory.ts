import { MethodConfig } from '../config/methodsConfig';
import { VitalLensOptions, VideoInput, Frame } from './core';

export interface IFrameIteratorFactory {
  createStreamFrameIterator(
    stream?: MediaStream, 
    videoElement?: HTMLVideoElement
  ): AsyncIterable<Frame>;
  createFileFrameIterator(
    videoInput: VideoInput,
    methodConfig: MethodConfig
  ): AsyncIterable<Frame>;
}
