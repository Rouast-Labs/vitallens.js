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
    worker.onmessage = (ev: MessageEvent) => {
      if (this.onmessage) this.onmessage(ev);
      this.messageHandlers.forEach((handler) => handler(ev));
    };
    worker.onerror = (ev: ErrorEvent) => {
      if (this.onerror) this.onerror(ev);
    };
  }

  postMessage(message: unknown, transfer?: Transferable[]): void {
    this.worker.postMessage(message, transfer ?? []);
  }

  terminate(): Promise<number> {
    this.worker.terminate();
    return Promise.resolve(0);
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
