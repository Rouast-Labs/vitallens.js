import { VitalLensControllerBase } from './VitalLensController.base';
import { VideoProcessor } from './VideoProcessor.browser'; // Browser version
import { VitalLensOptions } from '../types/core';
import { IVideoProcessor } from '../types/IVideoProcessor';

export class VitalLensController extends VitalLensControllerBase {
  protected createVideoProcessor(options: VitalLensOptions): IVideoProcessor {
    return new VideoProcessor(options);
  }
}
