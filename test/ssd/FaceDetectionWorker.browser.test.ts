import { FaceDetectionWorker } from '../../src/ssd/FaceDetectionWorker.browser';

// A fake Worker class that mimics the basic Worker API.
class FakeWorker {
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: ErrorEvent) => void) | null = null;
  postMessage = jest.fn();
  terminate = jest.fn();
}

describe('FaceDetectionWorker (Browser Extension)', () => {
  let fakeWorker: FakeWorker;
  let worker: FaceDetectionWorker;

  beforeEach(() => {
    fakeWorker = new FakeWorker();
    // Create an instance of FaceDetectionWorker wrapping our fake worker.
    worker = new FaceDetectionWorker(fakeWorker as unknown as Worker);
  });

  describe('postMessage', () => {
    it('should call the underlying worker.postMessage with the provided arguments', () => {
      const message = { test: 'data' };
      const transfer = [new ArrayBuffer(10)];
      worker.postMessage(message, transfer);
      expect(fakeWorker.postMessage).toHaveBeenCalledWith(message, transfer);
    });
  });

  describe('terminate', () => {
    it('should call worker.terminate and resolve to 0', async () => {
      // Optionally, you could have fakeWorker.terminate return a value.
      fakeWorker.terminate.mockImplementation(() => {});
      const result = await worker.terminate();
      expect(fakeWorker.terminate).toHaveBeenCalled();
      expect(result).toBe(0);
    });
  });

  describe('onmessage and addEventListener', () => {
    it('should call the onmessage property when a message event is fired', () => {
      const onMessageMock = jest.fn();
      worker.onmessage = onMessageMock;

      const event = new MessageEvent('message', { data: { foo: 'bar' } });
      // Simulate a message event by calling the fake worker’s onmessage.
      if (fakeWorker.onmessage) {
        fakeWorker.onmessage(event);
      }
      expect(onMessageMock).toHaveBeenCalledWith(event);
    });

    it('should call all added event listeners on a message event', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      worker.addEventListener('message', handler1);
      worker.addEventListener('message', handler2);

      const event = new MessageEvent('message', { data: { key: 'value' } });
      // Simulate the message event from the fake worker.
      if (fakeWorker.onmessage) {
        fakeWorker.onmessage(event);
      }
      expect(handler1).toHaveBeenCalledWith(event);
      expect(handler2).toHaveBeenCalledWith(event);
    });

    it('should remove an event listener via removeEventListener', () => {
      const handler = jest.fn();
      worker.addEventListener('message', handler);
      worker.removeEventListener('message', handler);

      const event = new MessageEvent('message', { data: { key: 'value' } });
      if (fakeWorker.onmessage) {
        fakeWorker.onmessage(event);
      }
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('onerror', () => {
    it('should call the onerror property when an error event is fired', () => {
      const onErrorMock = jest.fn();
      worker.onerror = onErrorMock;

      const errorEvent = new ErrorEvent('error', { message: 'Test error' });
      if (fakeWorker.onerror) {
        fakeWorker.onerror(errorEvent);
      }
      expect(onErrorMock).toHaveBeenCalledWith(errorEvent);
    });
  });
});
