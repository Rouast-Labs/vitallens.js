import { MethodConfig, ROI, VitalLensOptions, VitalLensResult } from '../types';
import { BufferManager } from './BufferManager';
import { checkFaceInROI, getROIForMethod } from '../utils/faceOps';
import { IFaceDetector } from '../types/IFaceDetector';
import { mergeFrames } from '../utils/arrayOps';
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

        // Process frames only at the target frame rate
        if (currentTime - this.lastProcessedTime < 1 / this.targetFps) {
          await new Promise((resolve) => setTimeout(resolve, 1 / this.targetFps - (currentTime - this.lastProcessedTime)));
          continue;
        }
        
        // Grab full frame
        const { value: frame, done } = await iterator.next();
        if (done || this.isPaused) break;

        if (frame) {
          this.lastProcessedTime = currentTime;

          if (this.useFaceDetector && this.faceDetector && currentTime - this.lastFaceDetectionTime > 1 / this.fDetFs) {
            await this.handleFaceDetection(frame, currentTime);
          }

          // Add frame to buffer(s)
          await this.bufferManager.add(frame);
  
          if (this.bufferManager.isReady() && this.methodHandler.getReady() && !this.isPredicting) {
            this.isPredicting = true;
            const frames = this.bufferManager.consume();       
            mergeFrames(frames)
              .then((framesChunk) => {
                const currentState = this.bufferManager.getState();
                return this.methodHandler.process(framesChunk, currentState);
              })
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
              });
          }
        }
      }
    };

    await this.frameIterator.start();
    processFrames().catch((error) => {
      console.error('Error in stream processing loop:', error);
    });
  }

  /**
   * Handle face detection.
   * @param frame TODO
   * @param currentTime TODO 
   * @returns TODO
   */
  private async handleFaceDetection(frame: Frame, currentTime: number): Promise<void> {  
    this.lastFaceDetectionTime = currentTime;
    await this.faceDetector!.run(frame, async (dets) => {
      if (frame.getShape().length === 3) {
        const absoluteDet = {
          x: Math.round(dets[0].x * frame.getShape()[1]),
          y: Math.round(dets[0].y * frame.getShape()[0]),
          width: Math.round(dets[0].width * frame.getShape()[1]),
          height: Math.round(dets[0].height * frame.getShape()[0]),
        };
        const shouldUpdateROI = this.options.method === 'vitallens' || (!this.roi || !checkFaceInROI(absoluteDet, this.roi, [0.6, 1.0]));
        if (shouldUpdateROI) {
          this.roi = getROIForMethod(absoluteDet, this.methodConfig, {
            height: frame.getShape()[0],
            width: frame.getShape()[1],
          }, true);
          this.bufferManager.addBuffer(this.roi, this.methodConfig, currentTime);
        }
      }
    });
  }
  
  /**
   * Stops the processing loop and clears the buffer.
   */
  stop(): void {
    this.isPaused = true;
    this.frameIterator.stop();
    this.bufferManager.cleanup();
  }
}
