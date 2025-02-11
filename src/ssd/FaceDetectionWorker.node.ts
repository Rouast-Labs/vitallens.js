import { Worker } from 'worker_threads';
import { FaceDetectionWorkerBase } from './FaceDetectionWorker.base';

export class FaceDetectionWorker extends FaceDetectionWorkerBase {
  private worker: Worker;
  private messageHandlers: Array<(ev: MessageEvent) => void> = [];
  public onmessage: ((ev: MessageEvent) => unknown) | null = null;
  public onmessageerror: ((ev: MessageEvent) => unknown) | null = null;
  public onerror: ((ev: ErrorEvent) => unknown) | null = null;

  constructor(worker: Worker) {
    super();
    this.worker = worker;
    worker.on('message', (msg: unknown) => {
      const event = { data: msg } as MessageEvent;
      if (this.onmessage) {
        this.onmessage(event);
      }
      this.messageHandlers.forEach((handler) => handler(event));
    });
    worker.on('error', (err: Error) => {
      if (this.onerror) {
        const event = {
          message: err.message,
          filename: '',
          lineno: 0,
          colno: 0,
          error: err,
        } as ErrorEvent;
        this.onerror(event);
      }
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  postMessage(message: unknown, transfer?: Transferable[]): void {
    this.worker.postMessage(message);
  }

  terminate(): Promise<number> {
    const result = this.worker.terminate();
    return Promise.resolve(result);
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject
  ): void {
    if (type === 'message' && typeof listener === 'function') {
      this.messageHandlers.push(listener as (ev: MessageEvent) => void);
    }
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject
  ): void {
    if (type === 'message' && typeof listener === 'function') {
      this.messageHandlers = this.messageHandlers.filter((l) => l !== listener);
    }
  }
}
