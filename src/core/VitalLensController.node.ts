import { VitalLensControllerBase } from './VitalLensController.base';
import { FrameIteratorFactory } from '../processing/FrameIteratorFactory.node';
import { VitalLensOptions } from '../types/core';
import { IFrameIteratorFactory } from '../types/IFrameIteratorFactory';
import { IFaceDetector } from '../types/IFaceDetector';
import { FaceDetectorAsync } from '../ssd/FaceDetectorAsync.node';
import { IRestClient } from '../types/IRestClient';
import { RestClient } from '../utils/RestClient.node';

export class VitalLensController extends VitalLensControllerBase {
  protected createFrameIteratorFactory(options: VitalLensOptions): IFrameIteratorFactory {
    return new FrameIteratorFactory(options);
  }
  protected createFaceDetector(): IFaceDetector {
    return new FaceDetectorAsync();
  }
  protected createRestClient(apiKey: string): IRestClient {
    return new RestClient(apiKey);
  }
}
