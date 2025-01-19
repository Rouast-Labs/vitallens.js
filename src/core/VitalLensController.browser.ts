import { VitalLensControllerBase } from './VitalLensController.base';
import { FrameIteratorFactory } from '../processing/FrameIteratorFactory.browser';
import { VitalLensOptions } from '../types/core';
import { IFrameIteratorFactory } from '../types/IFrameIteratorFactory';
import { IFaceDetector } from '../types/IFaceDetector';
import { FaceDetectorAsync } from '../ssd/FaceDetectorAsync.browser';

export class VitalLensController extends VitalLensControllerBase {
  protected createFrameIteratorFactory(options: VitalLensOptions): IFrameIteratorFactory {
    return new FrameIteratorFactory(options);
  }
  protected createFaceDetector(): IFaceDetector {
    return new FaceDetectorAsync();
  }
}
