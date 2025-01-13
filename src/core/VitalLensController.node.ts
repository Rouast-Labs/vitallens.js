import { VitalLensControllerBase } from './VitalLensController.base';
import { FrameIteratorFactory } from '../processing/FrameIteratorFactory.node';
import { VitalLensOptions } from '../types/core';
import { IFrameIteratorFactory } from '../types/IFrameIteratorFactory';

export class VitalLensController extends VitalLensControllerBase {
  protected createFrameIteratorFactory(options: VitalLensOptions): IFrameIteratorFactory {
    return new FrameIteratorFactory(options);
  }
}
