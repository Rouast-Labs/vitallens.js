import { MethodConfig, ROI, VitalLensOptions, VitalLensResult } from '../types';
import { BufferManager } from './BufferManager';
import { checkFaceInROI, checkROIInFace, getROIForMethod } from '../utils/faceOps';
import { IFaceDetector } from '../types/IFaceDetector';
import { MethodHandler } from '../methods/MethodHandler';
import { Frame } from './Frame';
import { IFrameIterator } from '../types/IFrameIterator';

/**
 * Manages the processing loop for live streams, including frame capture,
 * buffering, and triggering predictions.
 */
export class StreamProcessor {
  private isPaused = false;
  private isPredicting = false;
  private roi: ROI | null = null;
  private targetFps: number = 30.0;
  private fDetFs: number = 1.0;
  private lastProcessedTime: number = 0; // In seconds
  private lastFaceDetectionTime: number = 0; // In seconds
  private methodHandler: MethodHandler;
  private useFaceDetector: boolean;

  /**
   * Creates a new StreamProcessor.
   * @param options - Configuration options for VitalLens.
   * @param methodConfig - Method-specific settings (e.g. fps, ROI sizing).
   * @param frameIterator - Source of frames (webcam or other).
   * @param bufferManager - Manages frames for each ROI and method state.
   * @param faceDetector - Face detection interface (optional if global ROI is given).
   * @param methodHandler - Handles actual vital sign algorithm processing.
   * @param onPredict - Callback invoked with each new VitalLensResult.
   */
  constructor(
    private options: VitalLensOptions,
    private methodConfig: MethodConfig,
    private frameIterator: IFrameIterator,
    private bufferManager: BufferManager,
    private faceDetector: IFaceDetector,
    methodHandler: MethodHandler,
    private onPredict: (result: VitalLensResult) => Promise<void>
  ) {
    this.methodHandler = methodHandler;
    // Derive target fps
    this.targetFps = this.options.overrideFpsTarget ? this.options.overrideFpsTarget : this.methodConfig.fpsTarget;
    this.fDetFs = this.options.fDetFs ? this.options.fDetFs : 1.0;
    this.useFaceDetector = this.options.globalRoi === undefined;
  }

  /**
   * Initializes the StreamProcessor, setting up a global ROI if provided.
   */
  init() {
    if (!this.useFaceDetector && this.options.globalRoi) {
      this.roi = this.options.globalRoi;
      this.bufferManager.addBuffer(this.options.globalRoi, this.methodConfig, 1);
    }
  }

  /**
   * Starts the stream processing loop.
   */
  async start(): Promise<void> {
    this.init();
    this.isPaused = false;
    const iterator = this.frameIterator[Symbol.asyncIterator]();

    const processFrames = async () => {
      while (!this.isPaused) {
        const currentTime = performance.now()/1000; // In seconds

        // Throttle to target FPS
        if (currentTime - this.lastProcessedTime < 1 / this.targetFps) {
          await new Promise((resolve) => setTimeout(resolve, 1 / this.targetFps - (currentTime - this.lastProcessedTime)));
          continue;
        }
        
        const { value: frame, done } = await iterator.next();
        if (done || this.isPaused) break;
        if (!frame) continue;

        this.lastProcessedTime = currentTime;

        frame.retain();

        try {
          // Add frame to buffer(s). Use buffer ROI for vitallens, otherwise pass this.roi
          await this.bufferManager.add(frame, this.methodConfig.method !== 'vitallens' ? (this.roi ?? undefined) : undefined);

          // If buffers + method are ready, run a prediction
          if (this.bufferManager.isReady() && this.methodHandler.getReady() && !this.isPredicting) {
            this.isPredicting = true;
            this.bufferManager.consume().then((mergedFrame) => {
              if (!mergedFrame) {
                this.isPredicting = false;
                return;
              }
              const currentState = this.bufferManager.getState();
              this.methodHandler.process(mergedFrame, currentState)
                .then((incrementalResult) => {
                  if (incrementalResult) {
                    if (incrementalResult.state) {
                      this.bufferManager.setState(new Float32Array(incrementalResult.state.data));
                    } else {
                      this.bufferManager.resetState();
                    }
                    this.onPredict(incrementalResult);
                  }
                })
                .catch((error) => {
                  console.error("Error during prediction:", error);
                })
                .finally(() => {
                  this.isPredicting = false;
                  if (this.methodConfig.method !== 'vitallens') {
                    mergedFrame.release();
                  }
                });
            });
          }

          if (this.useFaceDetector && this.faceDetector && currentTime - this.lastFaceDetectionTime > 1 / this.fDetFs) {
            this.lastFaceDetectionTime = currentTime;
            this.handleFaceDetection(frame, currentTime);
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

  /**
   * Runs face detection on a single frame. If a face is found, updates the ROI in bufferManager.
   * @param frame - Current frame to detect face in.
   * @param currentTime - Timestamp in seconds.
   */
  private async handleFaceDetection(frame: Frame, currentTime: number): Promise<void> {
    this.faceDetector.run(frame, async (dets) => {
      if (!dets || dets.length < 1) return;

      if (frame.getShape().length === 3) {
        const absoluteDet = {
          x0: Math.round(dets[0].x0 * frame.getShape()[1]),
          y0: Math.round(dets[0].y0 * frame.getShape()[0]),
          x1: Math.round(dets[0].x1 * frame.getShape()[1]),
          y1: Math.round(dets[0].y1 * frame.getShape()[0]),
        };

        // Update ROI if it is null or the face has moved outside of the current ROI. 
        const shouldUpdateROI =
          this.roi === null ||
          (this.options.method === 'vitallens' && !checkFaceInROI(absoluteDet, this.roi, [0.6, 1.0])) ||
          (this.options.method !== 'vitallens' && !checkROIInFace(this.roi, absoluteDet, [1.0, 1.0]))
        
        if (shouldUpdateROI) {
          this.roi = getROIForMethod(
            absoluteDet,
            this.methodConfig,
            { height: frame.getShape()[0], width: frame.getShape()[1] },
            true
          );
          if (this.bufferManager.isEmpty() || this.options.method === 'vitallens') {
            // Add a new buffer only if we don't have one yet or if method is vitallens 
            this.bufferManager.addBuffer(this.roi, this.methodConfig, currentTime);
          }
        }
      }

      frame.release();
    });
  }
  
  /**
   * Stops the processing loop, halts frame iteration, and clears buffers.
   */
  stop(): void {
    this.isPaused = true;
    this.frameIterator.stop();
    this.bufferManager.cleanup();
  }
}
