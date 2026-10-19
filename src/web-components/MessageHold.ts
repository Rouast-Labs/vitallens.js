export interface MessageOptions {
  /** Keep this message on screen for at least the minimum time. */
  hold?: boolean;
  /** Show now, dropping any hold. */
  immediate?: boolean;
  /** Passed through to `apply`. */
  force?: boolean;
}

/**
 * Keeps a hint on screen long enough to read. While a held message is
 * showing, later messages wait and only the most recent one is shown.
 */
export class MessageHold {
  private current: string | null = null;
  private heldUntil = 0;
  private pending: { text: string; opts: MessageOptions } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private apply: (text: string, force: boolean) => void,
    private minMs = 3000,
    private now: () => number = () => performance.now()
  ) {}

  show(text: string, opts: MessageOptions = {}): void {
    if (opts.immediate) {
      this.release();
      this.applyNow(text, opts);
      return;
    }
    if (this.now() < this.heldUntil) {
      if (text === this.current) {
        this.clearPending();
      } else {
        this.pending = { text, opts };
        this.schedule();
      }
      return;
    }
    this.applyNow(text, opts);
  }

  /** Drops the hold and any waiting message. */
  release(): void {
    this.clearPending();
    this.heldUntil = 0;
  }

  private applyNow(text: string, opts: MessageOptions): void {
    // Re-showing the same message does not restart its hold.
    if (text !== this.current) {
      this.current = text;
      this.heldUntil = opts.hold ? this.now() + this.minMs : 0;
    }
    this.apply(text, opts.force ?? false);
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(
      () => {
        this.timer = null;
        const next = this.pending;
        this.pending = null;
        if (next) this.applyNow(next.text, next.opts);
      },
      Math.max(0, this.heldUntil - this.now())
    );
  }

  private clearPending(): void {
    this.pending = null;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
