import { VitalLensControllerBase } from './VitalLensController.base';
import { MethodConfig, VitalLensOptions, VitalLensResult } from '../types/core';
import { IRestClient } from '../types/IRestClient';
import { RestClient } from '../utils/RestClient.browser';
import { IWebSocketClient } from '../types/IWebSocketClient';
import { WebSocketClient } from '../utils/WebSocketClient.browser';
import { MethodHandler } from '../methods/MethodHandler';
import { BufferManager } from '../processing/BufferManager';
import { IFrameIterator } from '../types/IFrameIterator';
import { IStreamProcessor } from '../types/IStreamProcessor';
import { StreamProcessor } from '../processing/StreamProcessor.browser';
import faceDetectionWorkerDataURI from '../../dist/faceDetection.worker.browser.bundle.js';
import { IFFmpegWrapper } from '../types/IFFmpegWrapper';
import FFmpegWrapper from '../utils/FFmpegWrapper.browser';
import { IFaceDetectionWorker } from '../types/IFaceDetectionWorker';
import { FaceDetectionWorker } from '../ssd/FaceDetectionWorker.browser';

export class VitalLensController extends VitalLensControllerBase {
  protected createRestClient(apiKey: string): IRestClient {
    return new RestClient(apiKey);
  }
  protected createWebSocketClient(apiKey: string): IWebSocketClient {
    return new WebSocketClient(apiKey);
  }
  protected createFFmpegWrapper(): IFFmpegWrapper {
    return new FFmpegWrapper();
  }
  protected createFaceDetectionWorker(): IFaceDetectionWorker {
    // Create a browser Worker
    const worker = new Worker(faceDetectionWorkerDataURI);
    // Wrap it in our common interface wrapper.
    return new FaceDetectionWorker(worker);
  }
  protected createStreamProcessor(
    options: VitalLensOptions,
    methodConfig: MethodConfig,
    frameIterator: IFrameIterator,
    bufferManager: BufferManager,
    faceDetectionWorker: IFaceDetectionWorker | null,
    methodHandler: MethodHandler,
    onPredict: (result: VitalLensResult) => Promise<void>,
    onNoFace: () => Promise<void>
  ): IStreamProcessor {
    return new StreamProcessor(
      options,
      methodConfig,
      frameIterator,
      bufferManager,
      faceDetectionWorker,
      methodHandler,
      onPredict,
      onNoFace
    );
  }
}
