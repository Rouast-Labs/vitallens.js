import { describe, it, expect, vi } from 'vitest';
import { ConnectionMonitor } from '../../src/utils/ConnectionMonitor';

const opts = {
  medianMs: 1000,
  singleMs: 2000,
  maxFrames: 50,
  window: 5,
  minSamples: 3,
};

describe('ConnectionMonitor', () => {
  it('does not fire while the connection is fast', () => {
    const onSlow = vi.fn();
    const monitor = new ConnectionMonitor(onSlow, opts);
    for (let i = 0; i < 20; i++) monitor.record(250, 8);
    expect(onSlow).not.toHaveBeenCalled();
  });

  it('fires when the median request duration exceeds the limit', () => {
    const onSlow = vi.fn();
    const monitor = new ConnectionMonitor(onSlow, opts);
    monitor.record(1500, 10);
    monitor.record(1200, 10);
    expect(onSlow).not.toHaveBeenCalled(); // not enough samples yet
    monitor.record(1100, 10);
    expect(onSlow).toHaveBeenCalledTimes(1);
    expect(onSlow).toHaveBeenCalledWith({ medianMs: 1200, frames: 10 });
  });

  it('ignores a single moderately slow request among fast ones', () => {
    const onSlow = vi.fn();
    const monitor = new ConnectionMonitor(onSlow, opts);
    [250, 300, 1900, 260, 240].forEach((ms) => monitor.record(ms, 8));
    expect(onSlow).not.toHaveBeenCalled();
  });

  it('fires on the very first request if it is very slow', () => {
    const onSlow = vi.fn();
    const monitor = new ConnectionMonitor(onSlow, opts);
    monitor.record(3110, 16);
    expect(onSlow).toHaveBeenCalledWith({ medianMs: 3110, frames: 16 });
  });

  it('only considers the most recent requests', () => {
    const onSlow = vi.fn();
    const monitor = new ConnectionMonitor(onSlow, opts);
    [300, 300, 300, 300, 300].forEach((ms) => monitor.record(ms, 8));
    [2000, 2000].forEach((ms) => monitor.record(ms, 8));
    expect(onSlow).not.toHaveBeenCalled(); // window median is still 300
    monitor.record(2000, 8); // window is now 300, 300, 2000, 2000, 2000
    expect(onSlow).toHaveBeenCalledTimes(1);
  });

  it('fires when a request carries too many frames', () => {
    const onSlow = vi.fn();
    const monitor = new ConnectionMonitor(onSlow, opts);
    monitor.record(300, 8);
    monitor.record(300, 8);
    monitor.record(300, 51);
    expect(onSlow).toHaveBeenCalledWith({ medianMs: 300, frames: 51 });
  });

  it('fires on the first request if it already carries too many frames', () => {
    const onSlow = vi.fn();
    const monitor = new ConnectionMonitor(onSlow, opts);
    monitor.record(300, 60);
    expect(onSlow).toHaveBeenCalledTimes(1);
  });

  it('fires only once', () => {
    const onSlow = vi.fn();
    const monitor = new ConnectionMonitor(onSlow, opts);
    for (let i = 0; i < 10; i++) monitor.record(3000, 8);
    expect(onSlow).toHaveBeenCalledTimes(1);
  });

  it('can be reset to start over', () => {
    const onSlow = vi.fn();
    const monitor = new ConnectionMonitor(onSlow, opts);
    [3000, 3000, 3000].forEach((ms) => monitor.record(ms, 8));
    monitor.reset();
    [3000, 3000, 3000].forEach((ms) => monitor.record(ms, 8));
    expect(onSlow).toHaveBeenCalledTimes(2);
  });
});
