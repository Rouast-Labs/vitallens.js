import { VitalLensControllerBase } from './VitalLensController.base';
import { VideoInputProcessor } from '../processing/VideoInputProcessor.browser';
import { VitalLensOptions } from '../types/core';
import { IVideoInputProcessor } from '../types/IVideoInputProcessor';

export class VitalLensController extends VitalLensControllerBase {
  protected createVideoInputProcessor(options: VitalLensOptions): IVideoInputProcessor {
    return new VideoInputProcessor(options);
  }
}
