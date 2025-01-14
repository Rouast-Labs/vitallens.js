import { MethodConfig } from '../config/methodsConfig';
import { Frame, ROI, VitalLensOptions } from '../types';
import { FrameBufferManager } from './FrameBufferManager';
import { FaceDetector } from '../ssd/FaceDetector';
import { minimum } from '@tensorflow/tfjs';

/**
 * Manages the processing loop for live streams, including frame capture,
 * buffering, and triggering predictions.
 */
export class StreamProcessor {
  private isPaused = false;
  private isPredicting = false;
  private roi: ROI | null = null;
  private targetFps: number = 30.0;
  private lastProcessedTime: number = 0;
  private faceDetector: FaceDetector | null = null;

  constructor(
    private options: VitalLensOptions,
    private methodConfig: MethodConfig,
    private frameIterator: AsyncIterable<Frame>,
    private frameBufferManager: FrameBufferManager,
    private onPredict: (frames: Frame[]) => Promise<void>
  ) {
    // Derive target fps
    this.targetFps = this.options.overrideFpsTarget ? this.options.overrideFpsTarget : this.methodConfig.fpsTarget;

    if (options.globalRoi) {
      this.roi = options.globalRoi;
      // TODO: Set to use globalRoi
    } else {
      this.faceDetector = new FaceDetector();
    }
  }

  /**
   * Starts the stream processing loop.
   */
  async start(): Promise<void> {
    this.isPaused = false;
    const iterator = this.frameIterator[Symbol.asyncIterator]();

    const processFrames = async () => {
      while (!this.isPaused) {
        const currentTime = performance.now();

        // Process frames only at the target frame rate
        if (currentTime - this.lastProcessedTime < 1000 / this.targetFps) {
          await new Promise((resolve) => setTimeout(resolve, 1000 / this.targetFps));
          continue;
        }
        
        // Grab full frame
        const { value: frame, done } = await iterator.next();
        if (done || this.isPaused) break;

        if (frame) {
          this.lastProcessedTime = currentTime;
          
          if (this.faceDetector && runFaceDetection) {
            // Run face detection
            this.faceDetector.run(frame, 1, async (faceDet) => {
              if (this.options.method === 'vitallens') {
                // TODO: Determine if the new face detection has moved at least 50% of its width outside of the existing roi
                if (roiMovedSignificantly(this.roi, faceDet)) {
                  this.roi = getRoiFromFaceForMethod(faceDet, this.options.method);
                  this.frameBufferManager.addBuffer(this.roi, this.options.method, this.methodConfig.minWindowLength, this.methodConfig.maxWindowLength, this.lastProcessedTime);
                }
              } else {
                this.roi = getRoiFromFaceForMethod(faceDet, this.options.method);
                this.frameBufferManager.addBuffer(this.roi, this.options.method, this.methodConfig.minWindowLength, this.methodConfig.maxWindowLength, this.lastProcessedTime);
              }
            });
          }

          // Add frame to buffer(s)
          this.frameBufferManager.add(frame, currentTime);
  
          if (this.frameBufferManager.isReady() && !this.isPredicting) {
            this.isPredicting = true;
            const frames = this.frameBufferManager.consume();
            this.onPredict(frames).finally(() => {
              this.isPredicting = false;
            });
          }
        }
      }
    };

    processFrames().catch((error) => {
      console.error('Error in stream processing loop:', error);
    });
  }

  /**
   * Pauses the processing loop.
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * Resumes the processing loop.
   */
  resume(): void {
    if (this.isPaused) {
      this.isPaused = false;
      this.start();
    }
  }

  /**
   * Stops the processing loop and clears the buffer.
   */
  stop(): void {
    this.isPaused = true;
    this.frameBuffer.clear();
  }
}
