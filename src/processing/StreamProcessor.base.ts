import { MethodConfig, ROI, VitalLensOptions, VitalLensResult } from '../types';
import { BufferManager } from './BufferManager';
import { MethodHandler } from '../methods/MethodHandler';
import { Frame } from './Frame';
import { IFrameIterator } from '../types/IFrameIterator';
import { IFaceDetectionWorker } from '../types/IFaceDetectionWorker';
import { FDET_DEFAULT_FS_STREAM } from '../config/constants';

/**
 * Manages the processing loop for live streams, including frame capture,
 * buffering, and triggering predictions.
 */
export abstract class StreamProcessorBase {
  private isPaused = true;
  private isPredicting = false;
  protected isDetecting = false;
  protected roi: ROI | null = null;
  protected pendingRoi: ROI | null = null;
  private targetFps: number = 30.0;
  private fDetFs: number = 0.5;
  private lastProcessedTime: number = 0; // In seconds
  protected lastFaceDetectionTime: number = 0; // In seconds
  private methodHandler: MethodHandler;

  /**
   * Creates a new StreamProcessor.
   * @param options - Configuration options for VitalLens.
   * @param methodConfig - Method-specific settings (e.g. fps, ROI sizing).
   * @param frameIterator - Source of frames (webcam or other).
   * @param bufferManager - Manages frames for each ROI and method state.
   * @param faceDetectionWorker - Face detection worker (optional if global ROI is given).
   * @param methodHandler - Handles actual vital sign algorithm processing.
   * @param onPredict - Callback invoked with each new VitalLensResult.
   * @param onNoFace - Callback invoked when face is lost.
   */
  constructor(
    protected options: VitalLensOptions,
    protected methodConfig: MethodConfig,
    private frameIterator: IFrameIterator,
    protected bufferManager: BufferManager,
    protected faceDetectionWorker: IFaceDetectionWorker | null,
    methodHandler: MethodHandler,
    private onPredict: (result: VitalLensResult) => Promise<void>,
    protected onNoFace: () => Promise<void>
  ) {
    this.methodHandler = methodHandler;
    // Derive target fps
    this.targetFps = this.options.overrideFpsTarget
      ? this.options.overrideFpsTarget
      : this.methodConfig.fpsTarget;
    this.fDetFs = this.options.fDetFs ?? FDET_DEFAULT_FS_STREAM;

    if (this.faceDetectionWorker) {
      this.faceDetectionWorker.onmessage =
        this.handleFaceDetectionResult.bind(this);
      this.faceDetectionWorker.onerror = (error) => {
        console.error('Face detection worker error:', error);
      };
    }
  }

  /**
   * Initializes the StreamProcessor, setting up a global ROI if provided.
   */
  init() {
    if (!this.faceDetectionWorker && this.options.globalRoi) {
      this.roi = this.options.globalRoi;
      this.bufferManager.addBuffer(
        this.options.globalRoi,
        this.methodConfig,
        1
      );
    }
  }

  /**
   * Starts the stream processing loop.
   */
  async start(): Promise<void> {
    this.init();
    this.methodHandler.init();
    this.isPaused = false;
    const iterator = this.frameIterator[Symbol.asyncIterator]();

    const processFrames = async () => {
      while (!this.isPaused) {
        if (this.pendingRoi) {
          this.roi = this.pendingRoi;
          this.pendingRoi = null;
        }

        const currentTime = performance.now() / 1000; // In seconds

        // Throttle to target FPS
        if (currentTime - this.lastProcessedTime < 1 / this.targetFps) {
          await new Promise((resolve) =>
            setTimeout(
              resolve,
              1 / this.targetFps - (currentTime - this.lastProcessedTime)
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
              this.methodConfig.method !== 'vitallens'
                ? (this.roi ?? undefined)
                : undefined
            );
          }

          // If buffers + method are ready, run a prediction
          if (
            this.bufferManager.isReady() &&
            this.methodHandler.getReady() &&
            !this.isPredicting
          ) {
            this.isPredicting = true;
            this.bufferManager.consume().then((mergedFrame) => {
              if (!mergedFrame) {
                this.isPredicting = false;
                return;
              }
              const currentState = this.bufferManager.getState();
              this.methodHandler
                .process(mergedFrame, currentState as Float32Array)
                .then((incrementalResult) => {
                  if (incrementalResult) {
                    if (incrementalResult.state) {
                      this.bufferManager.setState(
                        new Float32Array(incrementalResult.state.data)
                      );
                    } else {
                      this.bufferManager.resetState();
                    }
                    this.onPredict(incrementalResult);
                  }
                })
                .catch((error) => {
                  console.error('Error during prediction:', error);
                })
                .finally(() => {
                  this.isPredicting = false;
                  if (this.methodConfig.method !== 'vitallens') {
                    mergedFrame.release();
                  }
                });
            });
          }

          if (
            this.faceDetectionWorker &&
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
    this.frameIterator.stop();
    this.methodHandler.cleanup();
    this.bufferManager.cleanup();
  }
}
