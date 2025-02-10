import { VitalLensControllerBase } from './VitalLensController.base';
import { MethodConfig, VitalLensOptions, VitalLensResult } from '../types/core';
import { IRestClient } from '../types/IRestClient';
import { RestClient } from '../utils/RestClient.node';
import { IWebSocketClient } from '../types/IWebSocketClient';
import { WebSocketClient } from '../utils/WebSocketClient.node';
import { MethodHandler } from '../methods/MethodHandler';
import { BufferManager } from '../processing/BufferManager';
import { IFrameIterator } from '../types/IFrameIterator';
import { IStreamProcessor } from '../types/IStreamProcessor';
import { StreamProcessor } from '../processing/StreamProcessor.node';
import faceDetectionWorkerDataURI from '../../dist/faceDetection.worker.node.bundle.js';
import { IFFmpegWrapper } from '../types/IFFmpegWrapper';
import FFmpegWrapper from '../utils/FFmpegWrapper.node';
import { Worker } from 'worker_threads';
import { FaceDetectionWorker } from '../ssd/FaceDetectionWorker.node';
import { IFaceDetectionWorker } from '../types/IFaceDetectionWorker';

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
    // Obtain the data URL string from inlined worker module and decode it.
    const code = Buffer.from(
      faceDetectionWorkerDataURI.split(',')[1],
      'base64'
    ).toString('utf8');
    // Create the Worker.
    const worker = new Worker(code, { eval: true });
    // Wrap the Worker in your common interface wrapper.
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
