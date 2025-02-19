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
import { createWorkerBlobURL } from '../utils/workerOps';

export class VitalLensController extends VitalLensControllerBase {
  protected createRestClient(apiKey: string, proxyUrl?: string): IRestClient {
    return new RestClient(apiKey, proxyUrl);
  }
  protected createWebSocketClient(
    apiKey: string,
    proxyUrl?: string
  ): IWebSocketClient {
    return new WebSocketClient(apiKey, proxyUrl);
  }
  protected createFFmpegWrapper(): IFFmpegWrapper {
    return new FFmpegWrapper();
  }
  protected createFaceDetectionWorker(): IFaceDetectionWorker {
    // Convert the inlined data URI to a Blob URL.
    const blobURL = createWorkerBlobURL(faceDetectionWorkerDataURI);

    // Create the browser Worker using the blob URL.
    const worker = new Worker(blobURL, { type: 'module' });

    // Wrap the worker with your interface wrapper.
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
