import { SetupTracker } from '../../src/web-components/SetupTracker';
import { describe, test, expect, beforeEach, vi } from 'vitest';

describe('SetupTracker', () => {
  let emit: (data: unknown) => void;
  let onDone: ReturnType<typeof vi.fn>;
  let onFailed: ReturnType<typeof vi.fn>;
  let tracker: SetupTracker;

  beforeEach(() => {
    const source = {
      addEventListener: (event: string, cb: (d: unknown) => void) => {
        if (event === 'status') emit = cb;
      },
    };
    onDone = vi.fn();
    onFailed = vi.fn();
    tracker = new SetupTracker(source, onDone, onFailed);
  });

  test('is done only when stream is ready and worker is ready', () => {
    emit({ stage: 'workerReady' });
    expect(onDone).not.toHaveBeenCalled();
    tracker.markStreamReady();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  test('order does not matter (stream first)', () => {
    tracker.markStreamReady();
    expect(onDone).not.toHaveBeenCalled();
    emit({ stage: 'workerReady', loadMs: 1200 });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  test('fires done only once', () => {
    tracker.markStreamReady();
    emit({ stage: 'workerReady' });
    emit({ stage: 'workerReady' });
    tracker.markStreamReady();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  test('a worker restart does not complete or fail setup', () => {
    tracker.markStreamReady();
    emit({ stage: 'workerRestart', attempt: 1, reason: 'x' });
    expect(onDone).not.toHaveBeenCalled();
    expect(onFailed).not.toHaveBeenCalled();
  });

  test.each(['detectorFailed', 'startFailed'])('%s calls onFailed', (stage) => {
    emit({ stage, reason: 'boom' });
    expect(onFailed).toHaveBeenCalledWith('boom');
    expect(onDone).not.toHaveBeenCalled();
  });
});
