/**
 * Tracks the start-up phase of a widget: done once the video stream is set
 * and the face detection worker reports ready. Also surfaces start-up failures.
 */
export interface StatusSource {
  addEventListener(event: string, callback: (data: unknown) => void): void;
}

export class SetupTracker {
  private streamReady = false;
  private workerReady = false;
  private finished = false;

  constructor(
    source: StatusSource,
    private onDone: () => void,
    private onFailed: (reason: string) => void
  ) {
    source.addEventListener('status', (data) => {
      const status = data as { stage?: string; reason?: string };
      if (status.stage === 'workerReady') {
        this.workerReady = true;
        this.check();
      } else if (
        status.stage === 'detectorFailed' ||
        status.stage === 'startFailed'
      ) {
        this.onFailed(status.reason ?? status.stage);
      }
    });
  }

  /** Call once `setVideoStream` has returned. */
  markStreamReady(): void {
    this.streamReady = true;
    this.check();
  }

  private check(): void {
    if (this.finished || !this.streamReady || !this.workerReady) return;
    this.finished = true;
    this.onDone();
  }
}
