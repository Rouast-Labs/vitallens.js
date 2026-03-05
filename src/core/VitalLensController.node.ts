import { VitalLensControllerBase } from './VitalLensController.base';
import { MethodConfig, VitalLensOptions, VitalLensResult } from '../types/core';
import { IRestClient } from '../types/IRestClient';
import { RestClient } from '../utils/RestClient.node';
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
import * as path from 'path';
import { fileURLToPath } from 'url';

function getBaseDir(): string {
  let currentDir = '';
  if (typeof __dirname !== 'undefined') {
    currentDir = __dirname;
  } else if (typeof import.meta !== 'undefined' && import.meta.url) {
    currentDir = path.dirname(fileURLToPath(import.meta.url));
  } else {
    currentDir = process.cwd();
  }

  if (process.env.RUN_INTEGRATION === 'true') {
    return path.resolve(currentDir, '../../dist');
  }
  return currentDir;
}

export class VitalLensController extends VitalLensControllerBase {
  protected createRestClient(apiKey: string, proxyUrl?: string): IRestClient {
    return new RestClient(apiKey, proxyUrl);
  }
  protected createFFmpegWrapper(): IFFmpegWrapper {
    return new FFmpegWrapper();
  }
  protected createFaceDetectionWorker(): IFaceDetectionWorker {
    const code = Buffer.from(
      faceDetectionWorkerDataURI.split(',')[1],
      'base64'
    ).toString('utf8');

    const worker = new Worker(code, {
      eval: true,
      workerData: { baseDir: getBaseDir() },
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
      onPredict,
      onNoFace,
      onStreamReset,
      onFaceDetected
    );
  }
}
