import { ROI, VideoProbeResult } from './core';

export interface IFaceDetectionWorker {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  terminate(): void | Promise<number>;
  onmessage: ((ev: MessageEvent) => unknown) | null;
  onmessageerror: ((ev: MessageEvent) => unknown) | null;
  onerror?: ((ev: ErrorEvent) => unknown) | null;
  addEventListener?(
    type: string,
    listener: EventListenerOrEventListenerObject
  ): void;
  removeEventListener?(
    type: string,
    listener: EventListenerOrEventListenerObject
  ): void;
  detectFaces(
    data: unknown,
    dataType: 'video' | 'frame',
    fs: number,
    timestamp?: number
  ): Promise<{ detections: ROI[]; probeInfo: VideoProbeResult }>;
}

export type DetectorStatus =
  | { stage: 'workerReady'; loadMs?: number }
  | { stage: 'workerRestart'; attempt: number; reason: string }
  | { stage: 'detectorFailed'; reason: string };

/** Optional hooks connecting a stream processor to the face detector's lifecycle. */
export interface DetectorHooks {
  isReady(): boolean;
  recreateWorker(): IFaceDetectionWorker;
  onStatus(status: DetectorStatus): void;
  report?(stage: 'detection' | 'apiRequest', ms: number): void;
}
