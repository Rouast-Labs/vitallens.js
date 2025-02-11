/* eslint-disable @typescript-eslint/no-explicit-any */
// FaceDetectionWorker.node.test.ts
import { Worker } from 'worker_threads';
import { FaceDetectionWorker } from '../../src/ssd/FaceDetectionWorker.node';

describe('FaceDetectionWorker (Real Worker - Node)', () => {
  // Inline dummy worker code:
  // - When receiving a message, if message.simulateError is true, throw an error.
  // - Otherwise, echo back the received message.
  const dummyWorkerCode = `
    const { parentPort } = require('worker_threads');
    parentPort.on('message', (msg) => {
      if (msg && msg.simulateError) {
        throw new Error('Test error');
      }
      parentPort.postMessage(msg);
    });
  `;

  let nodeWorker: Worker;
  let faceWorker: FaceDetectionWorker;

  beforeAll(() => {
    // Create a Worker from the inline code using eval.
    nodeWorker = new Worker(dummyWorkerCode, { eval: true });
    faceWorker = new FaceDetectionWorker(nodeWorker);
  });

  afterAll(async () => {
    // Terminate the worker when tests are finished.
    await faceWorker.terminate();
  });

  it('should echo messages via the real Worker', async () => {
    // Wrap the asynchronous response in a Promise.
    const echoPromise = new Promise<any>((resolve, reject) => {
      // Set the onmessage callback.
      faceWorker.onmessage = (event) => {
        resolve(event.data);
      };
      // Post a message.
      faceWorker.postMessage({ hello: 'world' });
      // Fail the test if no response is received within 3000 ms.
      setTimeout(() => reject(new Error('Timeout waiting for response')), 3000);
    });
    const data = await echoPromise;
    expect(data).toEqual({ hello: 'world' });
  }, 5000); // Set test timeout to 5000 ms.

  it('should propagate error events from the real Worker', async () => {
    // Wrap error response in a Promise.
    const errorPromise = new Promise<any>((resolve, reject) => {
      faceWorker.onerror = (event) => {
        resolve(event);
      };
      // Send a message that instructs the worker to throw an error.
      faceWorker.postMessage({ simulateError: true });
      // Fail the test if no error event is received within 3000 ms.
      setTimeout(() => reject(new Error('Timeout waiting for error')), 3000);
    });
    const errorEvent = await errorPromise;
    expect((errorEvent as any).message).toBe('Test error');
  }, 5000);
});
