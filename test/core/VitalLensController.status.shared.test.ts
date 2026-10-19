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

  describe('slow connection and frame rate changes', () => {
    beforeEach(() => {
      vi.spyOn(
        TestController.prototype as any,
        'createMethodHandler'
      ).mockReturnValue({
        getConfig: () => ({ fpsTarget: 30 }),
      });
    });

    test('reports slowConnection after slow requests at the standard frame rate', () => {
      const c = create();
      [1500, 1400, 1300].forEach((ms) =>
        (c as any).reportTiming('apiRequest', ms, 8)
      );
      expect(statuses).toEqual([
        { stage: 'slowConnection', medianMs: 1400, frames: 8 },
      ]);
    });

    test('does not report slow connections at the eco frame rate', () => {
      const c = new TestController({
        method: 'vitallens',
        overrideFpsTarget: 15,
      });
      statuses = [];
      c.addEventListener('status', (s) => statuses.push(s));
      [1500, 1400, 1300].forEach((ms) =>
        (c as any).reportTiming('apiRequest', ms, 8)
      );
      expect(statuses).toEqual([]);
    });

    test('ignores face detection timings for the connection check', () => {
      const c = create();
      [1500, 1400, 1300].forEach((ms) =>
        (c as any).reportTiming('detection', ms)
      );
      expect(statuses).toEqual([]);
    });

    test('setFpsTarget stops the stream and clears state', () => {
      const c = create();
      const stop = vi.fn();
      (c as any).streamProcessor = { stop };
      (c as any).session = {};
      c.setFpsTarget(15);
      expect(stop).toHaveBeenCalled();
      expect((c as any).streamProcessor).toBeNull();
      expect((c as any).session).toBeNull();
      expect((c as any).bufferManager.cleanup).toHaveBeenCalled();
      expect((c as any).options.overrideFpsTarget).toBe(15);
      expect(statuses).toEqual([{ stage: 'fpsChanged', fps: 15 }]);
    });

    test('setFpsTarget works without a running stream', () => {
      const c = create();
      expect(() => c.setFpsTarget(15)).not.toThrow();
    });

    test('after setFpsTarget the slow connection check starts over and stops at eco', () => {
      const c = create();
      [1500, 1400, 1300].forEach((ms) =>
        (c as any).reportTiming('apiRequest', ms, 8)
      );
      statuses.length = 0;
      c.setFpsTarget(15);
      statuses.length = 0;
      [1500, 1400, 1300].forEach((ms) =>
        (c as any).reportTiming('apiRequest', ms, 8)
      );
      expect(statuses).toEqual([]);
    });
  });
});
