import { MethodConfig } from '../config/methodsConfig';
import { ROI, VitalLensOptions } from '../types';
import { Frame } from './Frame';
import { BufferManager } from './BufferManager';
import { checkFaceInROI, getROIForMethod } from '../utils/faceOps';
import { IFrameIterator } from './FrameIterator.base';
import { IFaceDetector } from '../types/IFaceDetector';

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
  private faceDetector: IFaceDetector | null = null;

  constructor(
    private options: VitalLensOptions,
    private methodConfig: MethodConfig,
    private frameIterator: IFrameIterator,
    private bufferManager: BufferManager,
    faceDetector: IFaceDetector,
    private onPredict: (frames: Frame[]) => Promise<void>
  ) {
    // Derive target fps
    this.targetFps = this.options.overrideFpsTarget ? this.options.overrideFpsTarget : this.methodConfig.fpsTarget;
    this.fDetFs = this.options.fDetFs ? this.options.fDetFs : 1.0;

    if (options.globalRoi) {
      this.roi = options.globalRoi;
      this.bufferManager.addBuffer(options.globalRoi, this.methodConfig, 1);
    } else {
      this.faceDetector = faceDetector;
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
          
          if (this.faceDetector && currentTime - this.lastFaceDetectionTime > 1 / this.fDetFs) {
            // Run face detection
            this.lastFaceDetectionTime = currentTime;
            console.log("FaceDet started");
            this.faceDetector.run(frame, async (dets) => {
              console.log("FaceDet finished");
              console.log(`Number of buffers: ${this.bufferManager.getNBuffers()}`);
              if (frame.getShape().length === 3) {
                const absoluteDet = {
                  x: Math.round(dets[0].x * frame.getShape()[1]),
                  y: Math.round(dets[0].y * frame.getShape()[0]),
                  width: Math.round(dets[0].width * frame.getShape()[1]),
                  height: Math.round(dets[0].height * frame.getShape()[0]),
                };
                if (this.options.method === 'vitallens') {
                  if (!this.roi || !checkFaceInROI(absoluteDet, this.roi, [0.6, 1.0])) {
                    if (frame && frame.getShape().length == 3) {
                      this.roi = getROIForMethod(absoluteDet, this.methodConfig, { height: frame.getShape()[0], width: frame.getShape()[1] }, true)
                      this.bufferManager.addBuffer(this.roi, this.methodConfig, this.lastProcessedTime);
                    }
                  }
                } else {
                  if (frame && frame.getShape().length == 3) {
                    this.roi = getROIForMethod(absoluteDet, this.methodConfig, { height: frame.getShape()[0], width: frame.getShape()[1] }, true)
                    this.bufferManager.addBuffer(this.roi, this.methodConfig, this.lastProcessedTime);
                  }
                }
              }
            });
          }

          // Add frame to buffer(s)
          await this.bufferManager.add(frame, currentTime);
  
          if (this.bufferManager.isReady() && !this.isPredicting) {
            console.log("Predict");
            this.isPredicting = true;
            const frames = this.bufferManager.consume();
            // We are taking over the reference count on these frames from the buffer. No need to retain. 
            console.log("Entering StreamProcessor.onPredict");
            await this.onPredict(frames).finally(() => {
              console.log("onPredict.finally");
              this.isPredicting = false;
            });
            console.log("Exiting StreamProcessor.onPredict");
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
   * Stops the processing loop and clears the buffer.
   */
  stop(): void {
    this.isPaused = true;
    this.frameIterator.stop();
    this.bufferManager.cleanup();
  }
}
