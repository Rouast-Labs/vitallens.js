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
    timestamp?: number
  ): Promise<{ detections: ROI[]; probeInfo: VideoProbeResult }>;
}
