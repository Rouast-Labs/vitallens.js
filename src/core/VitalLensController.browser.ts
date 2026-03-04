import { VitalLensControllerBase } from './VitalLensController.base';
import { MethodConfig, VitalLensOptions, VitalLensResult } from '../types/core';
import { IRestClient } from '../types/IRestClient';
import { RestClient } from '../utils/RestClient.browser';
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
import { BufferedResultsConsumer } from '../processing/BufferedResultsConsumer';
import {
  FFMPEG_CORE_URL,
  FFMPEG_WASM_URL,
} from '../utils/FFmpegAssets.browser';

export class VitalLensController extends VitalLensControllerBase {
  protected createRestClient(apiKey: string, proxyUrl?: string): IRestClient {
    return new RestClient(apiKey, proxyUrl);
  }
  protected createFFmpegWrapper(): IFFmpegWrapper {
    return new FFmpegWrapper(FFMPEG_CORE_URL, FFMPEG_WASM_URL);
  }
  protected createFaceDetectionWorker(): IFaceDetectionWorker {
    const blobURL = createWorkerBlobURL(faceDetectionWorkerDataURI);
    const worker = new Worker(blobURL, { type: 'module' });

    let baseURL = window.location.href;
    try {
      if (typeof import.meta !== 'undefined' && import.meta.url) {
        baseURL = import.meta.url;
      }
    } catch (e) {}

    worker.postMessage({
      type: 'init',
      baseURL,
      coreURL: FFMPEG_CORE_URL,
      wasmURL: FFMPEG_WASM_URL,
    });

    return new FaceDetectionWorker(worker);
  }
  protected createStreamProcessor(
    options: VitalLensOptions,
    getConfig: () => MethodConfig,
    frameIterator: IFrameIterator,
    bufferManager: BufferManager,
    faceDetectionWorker: IFaceDetectionWorker | null,
    methodHandler: MethodHandler,
    bufferedResultsConsumer: BufferedResultsConsumer | null,
    onPredict: (result: VitalLensResult) => Promise<void>,
    onNoFace: () => Promise<void>,
    onStreamReset: () => Promise<void>,
    onFaceDetected?: (
      face: {
        coordinates: [number, number, number, number];
        confidence: number;
      } | null
    ) => void
  ): IStreamProcessor {
    return new StreamProcessor(
      options,
      getConfig,
      frameIterator,
      bufferManager,
      faceDetectionWorker,
      methodHandler,
      bufferedResultsConsumer,
      onPredict,
      onNoFace,
      onStreamReset,
      onFaceDetected
    );
  }
}
