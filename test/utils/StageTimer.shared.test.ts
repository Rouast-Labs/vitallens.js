import { StageTimer } from '../../src/utils/StageTimer';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

describe('StageTimer', () => {
  let t: number;
  let warn: ReturnType<typeof vi.spyOn>;
  let debug: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    t = 0;
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('mark returns elapsed ms once and null afterwards', () => {
    const timer = new StageTimer(false, () => t);
    t = 1200;
    expect(timer.mark('a')).toBe(1200);
    expect(timer.mark('a')).toBeNull();
    t = 1500;
    expect(timer.mark('b', 'a')).toBe(300);
  });

  test('debug logs stages with timestamps, silent otherwise', () => {
    const quiet = new StageTimer(false, () => t);
    quiet.mark('a');
    expect(debug).not.toHaveBeenCalled();
    const loud = new StageTimer(true, () => t);
    t = 50;
    loud.mark('a');
    expect(debug).toHaveBeenCalledWith(expect.stringContaining('+50 ms'));
  });

  test('watch warns when the stage is not reached in time', () => {
    const timer = new StageTimer(false, () => t);
    timer.watch('workerReady', 5000);
    vi.advanceTimersByTime(5001);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('workerReady'));
  });

  test('watch measures the limit from the given stage', () => {
    const timer = new StageTimer(false, () => t);
    t = 3000;
    timer.watch('x', 5000); // only 2000 ms left of the limit
    vi.advanceTimersByTime(2001);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  test('watch stays quiet when the stage was reached', () => {
    const timer = new StageTimer(false, () => t);
    timer.watch('workerReady', 5000);
    timer.mark('workerReady');
    vi.advanceTimersByTime(6000);
    expect(warn).not.toHaveBeenCalled();
  });

  test('dispose cancels pending watches', () => {
    const timer = new StageTimer(false, () => t);
    timer.watch('x', 1000);
    timer.dispose();
    vi.advanceTimersByTime(2000);
    expect(warn).not.toHaveBeenCalled();
  });

  test('report warns only above the limit', () => {
    const timer = new StageTimer(false, () => t);
    timer.report('API request', 2900, 3000);
    expect(warn).not.toHaveBeenCalled();
    timer.report('API request', 3100, 3000);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
