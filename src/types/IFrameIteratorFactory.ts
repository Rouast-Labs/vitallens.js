import { MethodConfig } from '../config/methodsConfig';
import { Frame, VitalLensOptions, VideoInput } from './core';

export interface IFrameIteratorFactory {
  createStreamFrameIterator(
    stream?: MediaStream, 
    videoElement?: HTMLVideoElement,
    options?: VitalLensOptions
  ): AsyncIterable<Frame>;
  createFileFrameIterator(
    videoInput: VideoInput,
    options: VitalLensOptions,
    methodConfig: MethodConfig
  ): AsyncIterable<Frame>;
}
