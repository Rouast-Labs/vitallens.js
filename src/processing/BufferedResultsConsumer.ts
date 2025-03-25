import { VitalLensResult } from '../types';

// TODO: Write tests

export class BufferedResultsConsumer {
  private resultQueue: VitalLensResult[] = [];
  private isRunning = false;
  private dispatch: (result: VitalLensResult) => void;

  constructor(dispatch: (result: VitalLensResult) => void) {
    this.dispatch = dispatch;
  }

  /**
   * Add new buffered results from the producer.
   * @param results An array of VitalLensResult objects that contain a `displayTime`
   *                property. These results are added to the consumer's queue.
   */
  addResults(results: VitalLensResult[]) {
    this.resultQueue.push(...results);
  }

  /**
   * Start the consumer loop.
   */
  start() {
    if (!this.isRunning) {
      this.isRunning = true;
      this.runLoop();
    }
  }

  /**
   * Stop the consumer loop.
   */
  stop() {
    this.isRunning = false;
  }

  /**
   * The consumer loop that checks for expired results.
   * This method continuously checks the buffered results and dispatches the latest result
   * whose displayTime is less than or equal to the current time.
   */
  private runLoop() {
    if (!this.isRunning) return;
    const now = performance.now() / 1000;

    // Schedule next frame.
    requestAnimationFrame(() => this.runLoop());

    // Find (if exists) the latest result in the queue that has not expired.
    let latestResult: VitalLensResult | null = null;
    while (
      this.resultQueue.length > 0 &&
      this.resultQueue[0].displayTime &&
      this.resultQueue[0].displayTime <= now
    ) {
      // Always update to the latest expired result.
      latestResult = this.resultQueue.shift()!;
    }

    // Dispatch the most recent expired result, if any.
    if (latestResult) {
      this.dispatch(latestResult);
    }
  }
}
