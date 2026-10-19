/**
 * Records start-up stage timings for diagnostics. Warns via `console.warn` when
 * a stage is slow; with `debug` also logs every stage via `console.debug`.
 */
export class StageTimer {
  private marks = new Map<string, number>();
  private timeouts = new Set<ReturnType<typeof setTimeout>>();

  constructor(
    private debug = false,
    private now: () => number = () => performance.now()
  ) {
    this.marks.set('start', this.now());
  }

  has(stage: string): boolean {
    return this.marks.has(stage);
  }

  /**
   * Records the first occurrence of a stage.
   * @param stage - Stage name.
   * @param from - Earlier stage to measure from.
   * @returns Milliseconds since `from`, or null if already marked.
   */
  mark(stage: string, from = 'start'): number | null {
    if (this.marks.has(stage)) return null;
    const t = this.now();
    this.marks.set(stage, t);
    const elapsed = t - (this.marks.get(from) ?? t);
    this.log(`${stage} after ${Math.round(elapsed)} ms (since ${from})`);
    return elapsed;
  }

  /**
   * Warns if `stage` has not been marked `limitMs` after `from` was marked.
   */
  watch(stage: string, limitMs: number, from = 'start'): void {
    const remaining = Math.max(
      0,
      limitMs - (this.now() - (this.marks.get(from) ?? this.now()))
    );
    const timeout = setTimeout(() => {
      this.timeouts.delete(timeout);
      if (!this.marks.has(stage)) {
        console.warn(
          `Slow start: ${stage} not reached ${limitMs} ms after ${from}.`
        );
      }
    }, remaining);
    // Don't keep a Node process alive just for a diagnostic.
    (timeout as { unref?: () => void }).unref?.();
    this.timeouts.add(timeout);
  }

  /**
   * Reports a duration, warning if it exceeds `limitMs`.
   */
  report(label: string, ms: number, limitMs: number): void {
    if (ms > limitMs) {
      console.warn(
        `Slow ${label}: ${Math.round(ms)} ms (limit ${limitMs} ms).`
      );
    } else {
      this.log(`${label} took ${Math.round(ms)} ms`);
    }
  }

  log(message: string): void {
    if (!this.debug) return;
    console.debug(
      `[VitalLens +${Math.round(this.now() - this.marks.get('start')!)} ms] ${message}`
    );
  }

  dispose(): void {
    this.timeouts.forEach(clearTimeout);
    this.timeouts.clear();
  }
}
