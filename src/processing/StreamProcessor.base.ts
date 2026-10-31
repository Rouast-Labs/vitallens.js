import { MethodConfig, ROI, VitalLensOptions, VitalLensResult } from '../types';
import { BufferManager } from './BufferManager';
import { MethodHandler } from '../methods/MethodHandler';
import { Frame } from './Frame';
import { IFrameIterator } from '../types/IFrameIterator';
import {
  IFaceDetectionWorker,
  DetectorHooks,
} from '../types/IFaceDetectionWorker';
import {
  FDET_DEFAULT_FS_STREAM,
  FDET_WATCHDOG_TIMEOUT,
  FDET_WATCHDOG_TIMEOUT_NOT_READY,
  FDET_WATCHDOG_MAX_RESTARTS,
  FDET_MAX_CONSECUTIVE_ERRORS,
} from '../config/constants';

/**
 * Manages the processing loop for live streams, including frame capture,
 * buffering, and triggering predictions.
 */
export abstract class StreamProcessorBase {
  private isPaused = true;
  private isPredicting = false;
  protected inferenceEnabled = true;
  protected isDetecting = false;
  protected roi: ROI | null = null;
  protected pendingRoi: ROI | null = null;
  private fDetFs: number = 0.5;
  private lastProcessedTime: number = 0; // In seconds
  protected lastFaceDetectionTime: number = 0; // In seconds
  private methodHandler: MethodHandler;
  private detectStartedAt: number | null = null; // Watchdog clock, in seconds
  private detectPendingSince: number | null = null;
  private notReadyWarned = false;
  private restartCount = 0;
  private consecutiveErrors = 0;
  private detectorFailed = false;
  // Incremented on stop and reset, so late responses of older requests are dropped
  private generation = 0;

  protected get methodConfig(): MethodConfig {
    return this.getConfig();
  }
  protected get targetFps(): number {
    return this.options.overrideFpsTarget ?? this.methodConfig.fpsTarget;
  }

  /**
   * Creates a new StreamProcessor.
   * @param options - Configuration options for VitalLens.
   * @param getConfig - Get the method-specific settings (e.g. fps, ROI sizing).
   * @param frameIterator - Source of frames (webcam or other).
   * @param bufferManager - Manages frames for each ROI and method state.
   * @param faceDetectionWorker - Face detection worker (optional if global ROI is given).
   * @param methodHandler - Handles actual vital sign algorithm processing.
   * @param onPredict - Callback invoked with each new VitalLensResult.
   * @param onNoFace - Callback invoked when face is lost.
   * @param onStreamReset - Callback invoked when stream is reset.
   * @param onFaceDetected - Callback for raw face detection events.
   */
  constructor(
    protected options: VitalLensOptions,
    private getConfig: () => MethodConfig,
    private frameIterator: IFrameIterator,
    protected bufferManager: BufferManager,
    protected faceDetectionWorker: IFaceDetectionWorker | null,
    methodHandler: MethodHandler,
    private onPredict: (result: VitalLensResult) => Promise<void>,
    protected onNoFace: () => Promise<void>,
    protected onStreamReset: () => Promise<void>,
    protected onFaceDetected?: (
      face: {
        coordinates: [number, number, number, number];
        confidence: number;
      } | null
    ) => void,
    protected detectorHooks?: DetectorHooks
  ) {
    this.methodHandler = methodHandler;
    this.fDetFs = this.options.fDetFs ?? FDET_DEFAULT_FS_STREAM;
    this.bindWorker();
  }

  /**
   * Attaches message and error handlers to the current face detection worker.
   */
  private bindWorker(): void {
    if (!this.faceDetectionWorker) return;
    this.faceDetectionWorker.onmessage = (event: MessageEvent) => {
      // Lifecycle messages are handled by the controller.
      if (event.data?.type === 'ready') return;
      this.handleFaceDetectionResult(event);
    };
    this.faceDetectionWorker.onerror = (error) => {
      console.error('Face detection worker error:', error);
    };
  }

  /**
   * Counts a failed detection. Marks the detector as failed after repeated errors.
   */
  protected registerDetectionError(): void {
    this.consecutiveErrors++;
    if (this.consecutiveErrors >= FDET_MAX_CONSECUTIVE_ERRORS) {
      this.failDetector('repeated detection errors');
    }
  }

  /**
   * Resets the count of consecutive detection errors.
   */
  protected registerDetectionSuccess(): void {
    this.consecutiveErrors = 0;
  }

  private failDetector(reason: string): void {
    if (this.detectorFailed) return;
    this.detectorFailed = true;
    console.warn(`Face detection failed: ${reason}`);
    this.detectorHooks?.onStatus({ stage: 'detectorFailed', reason });
  }

  /**
   * Restarts the worker if a detection has been pending for too long.
   * Before the worker reports ready the clock is paused (model load may be slow).
   * @param now - Current time in seconds.
   */
  private checkDetectionWatchdog(now: number): void {
    if (!this.faceDetectionWorker || !this.detectorHooks) return;
    if (!this.isDetecting) {
      this.detectStartedAt = null;
      this.detectPendingSince = null;
      return;
    }
    this.detectPendingSince ??= now;
    if (!this.detectorHooks.isReady()) {
      this.detectStartedAt = now;
      if (
        !this.notReadyWarned &&
        now - this.detectPendingSince > FDET_WATCHDOG_TIMEOUT_NOT_READY
      ) {
        this.notReadyWarned = true;
        console.warn(
          `Face detection worker not ready after ${FDET_WATCHDOG_TIMEOUT_NOT_READY}s.`
        );
      }
      return;
    }
    this.detectStartedAt ??= now;
    if (now - this.detectStartedAt > FDET_WATCHDOG_TIMEOUT) {
      this.restartDetector(`no detection result for ${FDET_WATCHDOG_TIMEOUT}s`);
    }
  }

  private restartDetector(reason: string): void {
    if (this.restartCount >= FDET_WATCHDOG_MAX_RESTARTS) {
      this.failDetector(`${reason}; restart limit reached`);
      return;
    }
    this.restartCount++;
    console.warn(
      `Restarting face detection worker (${this.restartCount}/${FDET_WATCHDOG_MAX_RESTARTS}): ${reason}`
    );
    void this.faceDetectionWorker!.terminate();
    this.faceDetectionWorker = this.detectorHooks!.recreateWorker();
    this.bindWorker();
    this.isDetecting = false;
    this.detectStartedAt = null;
    this.detectPendingSince = null;
    this.notReadyWarned = false;
    this.detectorHooks!.onStatus({
      stage: 'workerRestart',
      attempt: this.restartCount,
      reason,
    });
  }

  /**
   * Initializes the StreamProcessor, setting up a global ROI if provided.
   */
  init() {
    if (!this.faceDetectionWorker && this.options.globalRoi) {
      this.roi = this.options.globalRoi;
    }
  }

  /**
   * Enable or disable the API inference step.
   */
  setInferenceEnabled(enabled: boolean) {
    this.inferenceEnabled = enabled;
  }

  /**
   * Starts the stream processing loop.
   */
  async start(): Promise<void> {
    await this.methodHandler.init();
    this.init();
    this.isPaused = false;
    const iterator = this.frameIterator[Symbol.asyncIterator]();

    const processFrames = async () => {
      while (!this.isPaused) {
        const currentTime = performance.now() / 1000; // In seconds

        // Keep global ROI active
        if (this.options.globalRoi) {
          const activeRoi = this.bufferManager.processTarget(
            this.options.globalRoi,
            currentTime,
            this.methodConfig
          );
          if (activeRoi) {
            this.pendingRoi = activeRoi;
          }
        }

        this.checkDetectionWatchdog(currentTime);

        if (this.pendingRoi) {
          this.roi = this.pendingRoi;
          this.pendingRoi = null;
        }

        // Throttle to target FPS. Frame-paced iterators skip frames by capture time instead.
        if (this.frameIterator.isFramePaced?.()) {
          this.frameIterator.setFrameInterval?.(1 / this.targetFps);
        } else if (currentTime - this.lastProcessedTime < 1 / this.targetFps) {
          await new Promise((resolve) =>
            setTimeout(
              resolve,
              (1 / this.targetFps - (currentTime - this.lastProcessedTime)) *
                1000
            )
          );
          continue;
        }

        const { value: frame, done } = await iterator.next();
        if (done || this.isPaused) break;
        if (!frame) continue;

        this.lastProcessedTime = currentTime;

        // Retain the full frame. Released when face detection finishes/fails/not required.
        frame.retain();

        try {
          // Add frame to buffer(s). Use buffer ROI for vitallens, otherwise pass this.roi
          if (!this.bufferManager.isEmpty()) {
            await this.bufferManager.add(
              frame,
              !this.methodConfig.method.startsWith('vitallens')
                ? (this.roi ?? undefined)
                : undefined
            );
          }

          // If inference enabled and buffers + method are ready, run a prediction
          if (
            this.inferenceEnabled &&
            this.methodHandler.getReady() &&
            !this.isPredicting
          ) {
            const command = this.bufferManager.poll(currentTime, 'Stream');
            if (command) {
              this.isPredicting = true;
              this.bufferManager.consumeCommand(command).then((mergedFrame) => {
                if (!mergedFrame) {
                  this.isPredicting = false;
                  return;
                }
                const currentState = this.bufferManager.getState();
                const bufferSize = command.take_count;
                const requestStart = performance.now();
                const generation = this.generation;
                this.methodHandler
                  .process(
                    mergedFrame,
                    'stream',
                    currentState as Float32Array,
                    bufferSize
                  )
                  .then((incrementalResult) =>
                    this.handlePrediction(
                      incrementalResult,
                      generation,
                      performance.now() - requestStart,
                      bufferSize
                    )
                  )
                  .catch((error) => {
                    console.error('Error during prediction:', error);
                    if (error.message.includes('Resetting stream')) {
                      this.stop();
                      this.onStreamReset();
                    }
                  })
                  .finally(() => {
                    this.isPredicting = false;
                    if (!this.methodConfig.method.startsWith('vitallens')) {
                      mergedFrame.release();
                    }
                  });
              });
            }
          }

          if (
            this.faceDetectionWorker &&
            !this.detectorFailed &&
            !this.isDetecting &&
            currentTime - this.lastFaceDetectionTime > 1 / this.fDetFs
          ) {
            this.triggerFaceDetection(frame, currentTime);
          } else {
            frame.release();
          }
        } catch (error) {
          console.error('Error processing frame:', error);
          frame.release();
        }
      }
    };

    // Start capturing from frameIterator
    await this.frameIterator.start();

    // Start the async loop
    processFrames().catch((error) => {
      console.error('Error in stream processing loop:', error);
    });
  }

  // Abstract method/hook for running face detection.
  protected abstract triggerFaceDetection(
    frame: Frame,
    currentTime: number
  ): void;

  // Abstract method to handle worker responses with face detection results.
  protected abstract handleFaceDetectionResult(event: MessageEvent): void;

  /**
   * Applies the response of a stream request: stores the model state and passes
   * the result on. Responses to requests sent before the last stop or reset are
   * dropped, so their (stale) model state cannot leak into the new stream.
   * @param incrementalResult - The response, if any.
   * @param generation - Generation at the time the request was sent.
   * @param ms - Request duration in milliseconds.
   * @param frames - Number of frames sent with the request.
   */
  protected handlePrediction(
    incrementalResult: VitalLensResult | undefined,
    generation: number,
    ms: number,
    frames: number
  ): void {
    if (generation !== this.generation) return;
    this.detectorHooks?.report?.('apiRequest', ms, frames);
    if (!incrementalResult) return;
    if (incrementalResult.state) {
      this.bufferManager.setState(
        new Float32Array(incrementalResult.state.data)
      );
    } else {
      this.bufferManager.resetState();
    }
    this.onPredict(incrementalResult);
  }

  /**
   * Returns `true` we are actively processing
   * @returns Returns `true` we are actively processing
   */
  isProcessing(): boolean {
    return !this.isPaused;
  }

  /**
   * Stops the processing loop, halts frame iteration, and clears buffers.
   */
  stop(): void {
    this.isPaused = true;
    this.generation++;
    this.frameIterator.stop();
    this.methodHandler.cleanup();
    this.bufferManager.cleanup();
  }

  /**
   * Clears the ROI and buffers.
   */
  reset(): void {
    this.generation++;
    this.roi = null;
    this.pendingRoi = null;
    this.bufferManager.cleanup();
    this.isPredicting = false;
  }
}
