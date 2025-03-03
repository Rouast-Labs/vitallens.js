import { IFaceDetectionWorker } from '../types/IFaceDetectionWorker';
import { ROI, VideoProbeResult } from '../types/core';
import { FaceDetectorInput } from './FaceDetectorAsync.base';

export abstract class FaceDetectionWorkerBase implements IFaceDetectionWorker {
  abstract postMessage(message: unknown, transfer?: Transferable[]): void;
  abstract terminate(): void | Promise<number>;
  abstract addEventListener?(
    type: string,
    listener: EventListenerOrEventListenerObject
  ): void;
  abstract removeEventListener?(
    type: string,
    listener: EventListenerOrEventListenerObject
  ): void;
  abstract onmessage: ((ev: MessageEvent) => unknown) | null;
  abstract onmessageerror: ((ev: MessageEvent) => unknown) | null;
  abstract onerror?: ((ev: ErrorEvent) => unknown) | null;

  /**
   * Convenience method to send a detection request.
   * @param data - The input data (may be a Frame or a File/Blob)
   * @param dataType - Either 'frame' for Frame or 'video' for File/Blob
   * @param fs - Target frequency for face detection
   * @param timestamp - Optional timestamp
   * @returns Promise resolving to detections and probeInfo
   */
  async detectFaces(
    data: FaceDetectorInput,
    dataType: 'video' | 'frame',
    fs: number,
    timestamp?: number
  ): Promise<{ detections: ROI[]; probeInfo: VideoProbeResult }> {
    return new Promise((resolve, reject) => {
      const requestId = Date.now() + Math.random();
      const onMessage = (evt: MessageEvent): void => {
        const response = evt.data;
        // Only process messages that are objects with an "id" field.
        if (!response || typeof response !== 'object' || !('id' in response)) {
          return;
        }
        if (response.id === requestId) {
          // Use non-null assertion (or store the handler in a local variable)
          this.removeEventListener?.('message', onMessage as EventListener);
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve({
              detections: response.detections,
              probeInfo: response.probeInfo,
            });
          }
        }
      };
      this.addEventListener?.('message', onMessage as EventListener);
      this.postMessage({
        id: requestId,
        data,
        dataType,
        fs,
        timestamp,
      });
    });
  }
}
