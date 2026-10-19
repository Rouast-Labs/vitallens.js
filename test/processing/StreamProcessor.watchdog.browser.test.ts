/* eslint-disable @typescript-eslint/no-explicit-any */
import { StreamProcessor } from '../../src/processing/StreamProcessor.browser';
import { DetectorHooks } from '../../src/types/IFaceDetectionWorker';
import { describe, expect, beforeEach, afterEach, vi, it } from 'vitest';

describe('StreamProcessor face detection watchdog (Browser)', () => {
  let worker: any;
  let newWorker: any;
  let ready: boolean;
  let hooks: DetectorHooks;
  let onStatus: ReturnType<typeof vi.fn>;
  let processor: any;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  const makeWorker = () => ({
    postMessage: vi.fn(),
    terminate: vi.fn(),
    onmessage: null,
    onmessageerror: null,
  });

  beforeEach(() => {
    worker = makeWorker();
    newWorker = makeWorker();
    ready = true;
    onStatus = vi.fn();
    hooks = {
      isReady: () => ready,
      recreateWorker: vi.fn(() => newWorker),
      onStatus,
    };
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    processor = new StreamProcessor(
      { method: 'vitallens' } as any,
      () => ({ method: 'vitallens', fpsTarget: 30 }) as any,
      {} as any,
      { cleanup: vi.fn(), processTarget: vi.fn() } as any,
      worker,
      {} as any,
      vi.fn(),
      vi.fn(async () => {}),
      vi.fn(),
      vi.fn(),
      hooks
    );
  });

  afterEach(() => vi.restoreAllMocks());

  const startDetection = (t: number) => {
    processor.isDetecting = true;
    processor.checkDetectionWatchdog(t);
  };

  it('ignores worker ready messages', () => {
    const spy = vi.spyOn(processor, 'handleFaceDetectionResult');
    worker.onmessage({ data: { type: 'ready', loadMs: 100 } });
    expect(spy).not.toHaveBeenCalled();
    worker.onmessage({ data: { id: 0, detections: [], timestamp: 1 } });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not restart before the timeout', () => {
    startDetection(0);
    processor.checkDetectionWatchdog(7.9);
    expect(hooks.recreateWorker).not.toHaveBeenCalled();
  });

  it('restarts the worker when a detection never returns', () => {
    startDetection(0);
    processor.checkDetectionWatchdog(8.1);
    expect(worker.terminate).toHaveBeenCalled();
    expect(hooks.recreateWorker).toHaveBeenCalledTimes(1);
    expect(processor.faceDetectionWorker).toBe(newWorker);
    expect(newWorker.onmessage).toBeTypeOf('function');
    expect(processor.isDetecting).toBe(false);
    expect(onStatus).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'workerRestart', attempt: 1 })
    );
    expect(warnSpy).toHaveBeenCalled();
  });

  it('does not run the clock before the worker is ready, but warns once', () => {
    ready = false;
    startDetection(0);
    processor.checkDetectionWatchdog(19);
    expect(warnSpy).not.toHaveBeenCalled();
    processor.checkDetectionWatchdog(21);
    processor.checkDetectionWatchdog(40);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(hooks.recreateWorker).not.toHaveBeenCalled();
  });

  it('starts the 8 s clock when the worker becomes ready', () => {
    ready = false;
    startDetection(0);
    processor.checkDetectionWatchdog(15);
    ready = true;
    processor.checkDetectionWatchdog(15);
    processor.checkDetectionWatchdog(22);
    expect(hooks.recreateWorker).not.toHaveBeenCalled();
    processor.checkDetectionWatchdog(23.5);
    expect(hooks.recreateWorker).toHaveBeenCalledTimes(1);
  });

  it('gives up with detectorFailed after the restart cap and stops detecting', () => {
    let t = 0;
    for (let i = 0; i < 3; i++) {
      startDetection(t);
      t += 9;
      processor.checkDetectionWatchdog(t);
    }
    expect(hooks.recreateWorker).toHaveBeenCalledTimes(2);
    expect(onStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({ stage: 'detectorFailed' })
    );
    expect(processor.detectorFailed).toBe(true);
    // Further timeouts do not report again.
    startDetection(t);
    processor.checkDetectionWatchdog(t + 9);
    const failed = onStatus.mock.calls.filter(
      (c) => c[0].stage === 'detectorFailed'
    );
    expect(failed).toHaveLength(1);
  });

  it('is inert without detector hooks', () => {
    processor.detectorHooks = undefined;
    processor.isDetecting = true;
    expect(() => processor.checkDetectionWatchdog(100)).not.toThrow();
  });

  describe('timing reports', () => {
    const reply = (id: number, timestamp: number) =>
      ({ data: { id, detections: [], timestamp } }) as MessageEvent;

    it('reports the round trip of detections but not the first one', () => {
      const report = vi.fn();
      hooks.report = report;
      const now = performance.now() / 1000;
      processor.handleFaceDetectionResult(reply(0, now - 10));
      expect(report).not.toHaveBeenCalled();
      processor.handleFaceDetectionResult(reply(1, now - 4));
      expect(report).toHaveBeenCalledWith(
        'detection',
        expect.closeTo(4000, -3)
      );
    });
  });

  describe('error replies', () => {
    const errorEvent = () =>
      ({ data: { id: 0, error: 'Test error' } }) as MessageEvent;

    it('clears isDetecting and keeps lastFaceDetectionTime numeric', () => {
      processor.isDetecting = true;
      processor.handleFaceDetectionResult(errorEvent());
      expect(processor.isDetecting).toBe(false);
      expect(Number.isFinite(processor.lastFaceDetectionTime)).toBe(true);
    });

    it('fails the detector after 3 consecutive errors', () => {
      processor.handleFaceDetectionResult(errorEvent());
      processor.handleFaceDetectionResult(errorEvent());
      expect(onStatus).not.toHaveBeenCalled();
      processor.handleFaceDetectionResult(errorEvent());
      expect(onStatus).toHaveBeenCalledWith(
        expect.objectContaining({ stage: 'detectorFailed' })
      );
    });

    it('resets the error count on a successful reply', () => {
      processor.handleFaceDetectionResult(errorEvent());
      processor.handleFaceDetectionResult(errorEvent());
      processor.handleFaceDetectionResult({
        data: { id: 1, detections: [], timestamp: 1 },
      } as MessageEvent);
      processor.handleFaceDetectionResult(errorEvent());
      expect(onStatus).not.toHaveBeenCalled();
    });
  });
});
