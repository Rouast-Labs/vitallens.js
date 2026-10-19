/* eslint-disable @typescript-eslint/no-explicit-any */

import { VitalLensControllerBase } from '../../src/core/VitalLensController.base';
import { IFaceDetectionWorker } from '../../src/types/IFaceDetectionWorker';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../src/core/wasmProvider', () => ({ getCore: vi.fn() }));
vi.mock('../../src/processing/BufferManager');
vi.mock('../../src/processing/FrameIteratorFactory');
vi.mock('../../src/methods/MethodHandler');
vi.mock('../../src/methods/MethodHandlerFactory');
vi.mock('../../src/processing/Session');

let workerListener: ((ev: any) => void) | null = null;

class TestController extends VitalLensControllerBase {
  protected createRestClient(): any {
    return {};
  }
  protected createFFmpegWrapper(): any {
    return {};
  }
  protected createFaceDetectionWorker(): IFaceDetectionWorker {
    return {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null,
      onmessageerror: null,
      addEventListener: vi.fn((_type: string, l: any) => {
        workerListener = l;
      }),
    } as any;
  }
  protected createStreamProcessor(): any {
    return {};
  }
}

describe('VitalLensController status events and slow-start warnings', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let debug: ReturnType<typeof vi.spyOn>;
  let statuses: any[];

  const create = (debugOpt = false) => {
    const c = new TestController({ method: 'vitallens', debug: debugOpt });
    statuses = [];
    c.addEventListener('status', (s) => statuses.push(s));
    return c;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    workerListener = null;
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('worker ready message dispatches workerReady', () => {
    const c = create();
    workerListener!({ data: { type: 'ready', loadMs: 1234 } });
    expect(statuses).toEqual([{ stage: 'workerReady', loadMs: 1234 }]);
    expect((c as any).detectorReady).toBe(true);
  });

  test('worker ready with error dispatches detectorFailed', () => {
    const c = create();
    workerListener!({ data: { type: 'ready', error: 'boom' } });
    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toMatchObject({ stage: 'detectorFailed' });
    expect(statuses[0].reason).toContain('boom');
    expect((c as any).detectorReady).toBe(false);
  });

  test('ignores unrelated worker messages', () => {
    create();
    workerListener!({ data: { id: 0, detections: [] } });
    expect(statuses).toEqual([]);
  });

  test('warns when the worker is not ready after 5 s', () => {
    const c = create();
    (c as any).watchStreamStartup();
    vi.advanceTimersByTime(5001);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('workerReady'));
  });

  test('does not warn about the worker when it is ready in time', () => {
    const c = create();
    (c as any).watchStreamStartup();
    vi.advanceTimersByTime(2000);
    workerListener!({ data: { type: 'ready', loadMs: 2000 } });
    vi.advanceTimersByTime(6000);
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining('workerReady')
    );
  });

  test('warns when no face is found after 8 s', () => {
    const c = create();
    (c as any).watchStreamStartup();
    vi.advanceTimersByTime(8001);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('firstFace'));
  });

  test('a rejected start() dispatches startFailed instead of going unhandled', async () => {
    const c = create();
    (c as any).streamProcessor = {
      isProcessing: () => false,
      start: vi.fn().mockRejectedValue(new Error('resolve-model failed')),
    };
    c.startVideoStream();
    await vi.advanceTimersByTimeAsync(0);
    expect(statuses).toEqual([
      { stage: 'startFailed', reason: 'resolve-model failed' },
    ]);
    expect(warn).toHaveBeenCalled();
  });

  test('does not warn when no live stream is started (file processing)', () => {
    create();
    vi.advanceTimersByTime(30000);
    expect(warn).not.toHaveBeenCalled();
  });

  test('debug option logs stages', () => {
    create(true);
    workerListener!({ data: { type: 'ready', loadMs: 10 } });
    expect(debug).toHaveBeenCalledWith(expect.stringContaining('workerReady'));
  });

  test('dispose cancels the slow-start warnings', async () => {
    const c = create();
    (c as any).watchStreamStartup();
    await c.dispose();
    vi.advanceTimersByTime(10000);
    expect(warn).not.toHaveBeenCalled();
  });
});
