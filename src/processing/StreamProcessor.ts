import { MethodConfig } from '../config/methodsConfig';
import { ROI, VitalLensOptions } from '../types';
import { Frame } from './Frame';
import { BufferManager } from './BufferManager';
import { FaceDetector } from '../ssd/FaceDetector';

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
  private lastProcessedTime: number = 0;
  private lastFaceDetectionTime: number = 0;
  private faceDetector: FaceDetector | null = null;

  constructor(
    private options: VitalLensOptions,
    private methodConfig: MethodConfig,
    private frameIterator: AsyncIterable<Frame>,
    private bufferManager: BufferManager,
    private onPredict: (frames: Frame[]) => Promise<void>
  ) {
    // Derive target fps
    this.targetFps = this.options.overrideFpsTarget ? this.options.overrideFpsTarget : this.methodConfig.fpsTarget;
    this.fDetFs = this.options.fDetFs ? this.options.fDetFs : 1.0;

    if (options.globalRoi) {
      this.roi = options.globalRoi;
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
          frame.retain(); // 1
          this.lastProcessedTime = currentTime;
          
          if (this.faceDetector && currentTime - this.lastFaceDetectionTime > 1000 / this.fDetFs) {
            // Run face detection
            this.faceDetector.run(frame, 1, async (faceDet) => {
              if (this.options.method === 'vitallens') {
                if (!this.roi || roiMovedSignificantly(this.roi, faceDet)) {
                  this.roi = getRoiFromFaceForMethod(faceDet, this.options.method);
                  this.bufferManager.addBuffer(this.roi, this.options.method, this.methodConfig.minWindowLength, this.methodConfig.maxWindowLength, this.lastProcessedTime);
                }
              } else {
                this.roi = getRoiFromFaceForMethod(faceDet, this.options.method);
                this.bufferManager.addBuffer(this.roi, this.options.method, this.methodConfig.minWindowLength, this.methodConfig.maxWindowLength, this.lastProcessedTime);
              }
            });
          }

          // Add frame to buffer(s)
          await this.bufferManager.add(frame, currentTime).finally(() => {
            frame.release(); // 0 (or 1 if in use by face detector)
          });
  
          if (this.bufferManager.isReady() && !this.isPredicting) {
            this.isPredicting = true;
            const frames = this.bufferManager.consume();
            // We are taking over the reference count on these frames from the buffer. No need to retain. 
            this.onPredict(frames).finally(() => {
              this.isPredicting = false;
              // Release the frames
              frames.forEach((frame) => frame.release());
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
    this.bufferManager.cleanup();
  }
}

/**
 * Checks if the ROI has moved significantly from the previous one.
 */
// TODO: Review this function and use it where needed
function roiMovedSignificantly(prevRoi: ROI, newRoi: ROI): boolean {
  const dx = Math.abs(prevRoi.x - newRoi.x);
  const dy = Math.abs(prevRoi.y - newRoi.y);
  return dx > prevRoi.width * 0.5 || dy > prevRoi.height * 0.5;
}

/**
 * Generates an ROI from face detection results for a specific method.
 */
// TODO: Review this function and use it where needed
function getRoiFromFaceForMethod(faceDet: any, method: string): ROI {
  return {
    x: faceDet.boundingBox.x,
    y: faceDet.boundingBox.y,
    width: faceDet.boundingBox.width,
    height: faceDet.boundingBox.height,
  };
}
