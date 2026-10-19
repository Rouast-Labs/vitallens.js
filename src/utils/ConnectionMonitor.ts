import {
  SLOW_CONNECTION_MEDIAN_MS,
  SLOW_CONNECTION_MAX_FRAMES,
  SLOW_CONNECTION_WINDOW,
  SLOW_CONNECTION_MIN_SAMPLES,
} from '../config/constants';

export interface ConnectionMonitorOptions {
  /** Median request duration (ms) above which the connection counts as slow. */
  medianMs: number;
  /** Frames in a single request above which the connection counts as slow. */
  maxFrames: number;
  /** Number of most recent requests the median is taken over. */
  window: number;
  /** Requests needed before any decision is made. */
  minSamples: number;
}

export interface SlowConnectionInfo {
  medianMs: number;
  frames: number;
}

const DEFAULTS: ConnectionMonitorOptions = {
  medianMs: SLOW_CONNECTION_MEDIAN_MS,
  maxFrames: SLOW_CONNECTION_MAX_FRAMES,
  window: SLOW_CONNECTION_WINDOW,
  minSamples: SLOW_CONNECTION_MIN_SAMPLES,
};

/**
 * Decides from stream request timings whether the connection is too slow for
 * the current frame rate. Calls `onSlow` once, until reset.
 */
export class ConnectionMonitor {
  private durations: number[] = [];
  private samples = 0;
  private fired = false;
  private options: ConnectionMonitorOptions;

  constructor(
    private onSlow: (info: SlowConnectionInfo) => void,
    options: Partial<ConnectionMonitorOptions> = {}
  ) {
    this.options = { ...DEFAULTS, ...options };
  }

  /**
   * Records one stream request.
   * @param ms - Time from sending the request to receiving the response.
   * @param frames - Number of frames sent in the request.
   */
  record(ms: number, frames: number): void {
    if (this.fired) return;
    this.samples++;
    this.durations.push(ms);
    if (this.durations.length > this.options.window) this.durations.shift();
    if (this.samples < this.options.minSamples) return;

    const medianMs = this.median();
    if (medianMs > this.options.medianMs || frames > this.options.maxFrames) {
      this.fired = true;
      this.onSlow({ medianMs, frames });
    }
  }

  reset(): void {
    this.durations = [];
    this.samples = 0;
    this.fired = false;
  }

  private median(): number {
    const sorted = [...this.durations].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }
}
