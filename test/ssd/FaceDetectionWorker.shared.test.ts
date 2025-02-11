/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { FaceDetectionWorkerBase } from '../../src/ssd/FaceDetectionWorker.base';
import { ROI, VideoProbeResult } from '../../src/types/core';
import { FaceDetectorInput } from '../../src/ssd/FaceDetectorAsync.base';

// Create a concrete subclass for testing.
class TestFaceDetectionWorker extends FaceDetectionWorkerBase {
  public messageListeners: Array<EventListener> = [];
  public onmessage: ((ev: MessageEvent) => unknown) | null = null;
  public onmessageerror: ((ev: MessageEvent) => unknown) | null = null;
  public onerror: ((ev: ErrorEvent) => unknown) | null = null;
  public lastMessage: unknown = null;
  postMessage(message: unknown, transfer?: Transferable[]): void {
    this.lastMessage = message;
  }
  terminate(): void {}
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject
  ): void {
    if (type === 'message') {
      this.messageListeners.push(listener as EventListener);
    }
  }
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject
  ): void {
    if (type === 'message') {
      this.messageListeners = this.messageListeners.filter(
        (l) => l !== (listener as EventListener)
      );
    }
  }
  simulateMessage(response: any): void {
    const event = new MessageEvent('message', { data: response });
    for (const listener of this.messageListeners) {
      listener(event);
    }
  }
}

describe('FaceDetectionWorkerBase', () => {
  let worker: TestFaceDetectionWorker;

  // Create a dummy FaceDetectorInput. (Adjust as needed for your interface.)
  const dummyInput: FaceDetectorInput = {} as FaceDetectorInput;

  beforeEach(() => {
    worker = new TestFaceDetectionWorker();
  });

  it('should resolve detectFaces when a matching response with detections is received', async () => {
    const dataType = 'frame' as const;
    const timestamp = 123;

    // Call detectFaces; it returns a promise.
    const promise = worker.detectFaces(dummyInput, dataType, timestamp);

    // Retrieve the sent message. It should include an id, data, dataType, and timestamp.
    const sentMessage = worker.lastMessage as any;
    expect(sentMessage).toBeDefined();
    expect(sentMessage.data).toBe(dummyInput);
    expect(sentMessage.dataType).toBe(dataType);
    expect(sentMessage.timestamp).toBe(timestamp);

    // Capture the generated request id.
    const requestId = sentMessage.id;
    // Prepare dummy detections and probeInfo.
    const dummyDetections: ROI[] = [{ x0: 1, y0: 2, x1: 3, y1: 4 }];
    const dummyProbeInfo: VideoProbeResult = {
      totalFrames: 100,
      fps: 30,
      width: 640,
      height: 480,
      codec: 'h264',
      bitrate: 1000,
      rotation: 0,
      issues: false,
    };

    // Simulate receiving a response message with the same request id.
    worker.simulateMessage({
      id: requestId,
      detections: dummyDetections,
      probeInfo: dummyProbeInfo,
    });

    // Await the promise resolution.
    const result = await promise;
    expect(result).toEqual({
      detections: dummyDetections,
      probeInfo: dummyProbeInfo,
    });
  });

  it('should reject detectFaces when a matching response with an error is received', async () => {
    const dataType = 'video' as const;
    const timestamp = 456;

    const promise = worker.detectFaces(dummyInput, dataType, timestamp);

    const sentMessage = worker.lastMessage as any;
    expect(sentMessage).toBeDefined();
    const requestId = sentMessage.id;

    // Simulate receiving an error response.
    worker.simulateMessage({
      id: requestId,
      error: 'Detection failed',
    });

    await expect(promise).rejects.toThrow('Detection failed');
  });
});
