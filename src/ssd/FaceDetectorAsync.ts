import * as tf from '@tensorflow/tfjs';
import * as path from 'path';
import { Frame } from "../processing/Frame";
import { ROI } from "../types/core";
import { IFaceDetector } from "../types/IFaceDetector";

/**
 * Face detector class, implementing detection via a machine learning model.
 */
export class FaceDetectorAsync implements IFaceDetector {
  private model: tf.GraphModel | null = null;

  constructor(
    private maxFaces: number = 1,
    private scoreThreshold: number = 0.5,
    private iouThreshold: number = 0.3
  ) {
    this.init();
  }

  /**
   * Loads the face detection model and logs initialization parameters.
   */
  private async init(): Promise<void> {
    const modelPath = path.resolve(__dirname, '../../models/Ultra-Light-Fast-Generic-Face-Detector-1MB/model.json'); // Adjust as needed
    try {
      this.model = await tf.loadGraphModel(`file://${modelPath}`);
    } catch (error) {
      console.error("Failed to load the face detection model:", error);
    }
  }

  /**
   * Runs face detection on the provided frame and returns an array of ROIs.
   * @param frame - The input frame containing a batch of images as a Tensor4D.
   * @returns A promise resolving to an array of detected ROIs.
   */
  async detect(frame: Frame): Promise<ROI[]> {
    if (!this.model) {
      throw new Error("Face detection model is not loaded.");
    }
  
    frame.retain();
    const nFrames = frame.data.rank === 3 ? 1 : frame.data.shape[0];

    try {

      const input = tf.tidy(() => {
        if (frame.data.rank === 3) {
          return tf.expandDims(frame.data.toFloat().sub(127.0).div(128.0), 0);
        } else {
          return frame.data.toFloat().sub(127.0).div(128.0)
        }
      });

      // Perform inference
      const outputs = (await this.model.executeAsync(input)) as tf.Tensor;
  
      input.dispose();
  
      // Perform non-max suppression per frame in the batch
      const selectedBoxes: ROI[] = [];
      for (let i = 0; i < nFrames; i++) {
        const frameBoxes = tf.slice(outputs, [i, 0, 2], [1, -1, 4]).squeeze(); // Shape: (N_ANCHORS, 4)
        const frameScores = tf.slice(outputs, [i, 0, 1], [1, -1, 1]).squeeze(); // Shape: (N_ANCHORS,)
  
        // Perform NMS for this frame
        const nmsIndices = await tf.image.nonMaxSuppressionAsync(
          frameBoxes as tf.Tensor2D,
          frameScores as tf.Tensor1D,
          this.maxFaces,
          this.iouThreshold,
          this.scoreThreshold
        );
  
        // Gather the selected boxes
        const nmsIndicesInt32 = nmsIndices.toInt();
        const selectedFrameBoxesTensor = tf.gather(frameBoxes, nmsIndicesInt32);
        const selectedFrameBoxes = (selectedFrameBoxesTensor.arraySync() as number[][]).map(
          ([xMin, yMin, xMax, yMax]: number[]) => ({
            x: xMin,
            y: yMin,
            width: xMax - xMin,
            height: yMax - yMin,
          })
        );
  
        selectedBoxes.push(...selectedFrameBoxes);
        
        // TODO: Check if not disposing causes memory leak
        // nmsIndices.dispose();
        nmsIndicesInt32.dispose();
        selectedFrameBoxesTensor.dispose();
      }
      
      // TODO: Check if not disposing causes memory leak
      // outputs.dispose();
  
      return selectedBoxes;
    } finally {
      frame.release(); // Decrement reference count
    }
  }
  

  /**
   * Runs detection and invokes the callback with the results.
   * @param frame - The input frame for face detection.
   * @param onFinish - Callback to handle the detection results.
   */
  async run(frame: Frame, onFinish: (detectionResults: ROI[]) => Promise<void>): Promise<void> {
    const detections = await this.detect(frame);
    await onFinish(detections);
  }
}
