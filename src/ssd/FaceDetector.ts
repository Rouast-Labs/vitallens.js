import * as tf from '@tensorflow/tfjs';
import { Frame } from "../processing/Frame";
import { ROI } from "../types/core";
import { IFaceDetector } from "../types/IFaceDetector";

/**
 * Face detector class, implementing detection via a machine learning model.
 */
export class FaceDetector implements IFaceDetector {
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
    const modelPath = '/models/Ultra-Light-Fast-Generic-Face-Detector-1MB/model.json';
    try {
      this.model = await tf.loadGraphModel(modelPath);
      console.log(
        `FaceDetector initialized with maxFaces=${this.maxFaces}, scoreThreshold=${this.scoreThreshold}, iouThreshold=${this.iouThreshold}`
      );
    } catch (error) {
      console.error("Failed to load the face detection model:", error);
    }
  }

  /**
   * Runs face detection on the provided frame and returns tensors containing ROIs.
   * @param frame - The input frame containing a batch of images as a Tensor4D.
   * @returns A promise resolving to tensors containing ROIs.
   */
  async detect(frame: Frame): Promise<ROI[]> {
    if (!this.model) {
      throw new Error("Face detection model is not loaded.");
    }

    frame.retain();

    try {
      const roiTensor = tf.tidy(() => {
        // Normalize the input
        const normalizedInput = frame.data.toFloat().sub(127.0).div(128.0);

        // Perform inference
        const outputs = this.model!.execute(normalizedInput) as tf.Tensor[];

        const batchSize = frame.data.shape[0];
        const allSelectedBoxes: tf.Tensor[] = [];

        for (let i = 0; i < batchSize; i++) {
          // Extract boxes and scores for this frame
          const frameBoxes = tf.slice(outputs[0], [i, 0, 2], [1, -1, 4]).squeeze() as tf.Tensor2D;
          const frameScores = tf.slice(outputs[0], [i, 1], [1, -1]).squeeze() as tf.Tensor1D;

          // Perform non-max suppression
          const nmsIndices = tf.image.nonMaxSuppression(
            frameBoxes,
            frameScores,
            this.maxFaces,
            this.iouThreshold,
            this.scoreThreshold
          );

          // Gather the selected boxes
          const selectedFrameBoxes = tf.gather(frameBoxes, nmsIndices.toInt());

          allSelectedBoxes.push(selectedFrameBoxes);

          nmsIndices.dispose();
          frameBoxes.dispose();
          frameScores.dispose();
        }

        outputs.forEach((tensor) => tensor.dispose());

        // Return selected boxes as a tensor container
        return { selectedBoxes: allSelectedBoxes };
      });

      return await this.tensorContainerToROIArray(roiTensor);
    } finally {
      frame.release(); // Decrement reference count
    }
  }

  /**
   * Converts a tensor container of ROIs to an array of ROIs.
   * @param tensorContainer - The tensor container returned from `detect`.
   * @returns An array of ROIs.
   */
  async tensorContainerToROIArray(tensorContainer: tf.TensorContainer): Promise<ROI[]> {
    const { selectedBoxes } = tensorContainer as { selectedBoxes: tf.Tensor[] };
    const roiArray: ROI[] = [];

    for (const boxes of selectedBoxes) {
      const boxArray = (await boxes.array()) as number[][]; // Explicitly cast to number[][]
      roiArray.push(
        ...boxArray.map(([yMin, xMin, yMax, xMax]) => ({
          x: xMin,
          y: yMin,
          width: xMax - xMin,
          height: yMax - yMin,
        }))
      );
      boxes.dispose();
    }

    return roiArray;
  }

  /**
   * Runs detection and invokes the callback with the results.
   * @param frame - The input frame for face detection.
   * @param onFinish - Callback to handle the detection results.
   */
  async run(frame: Frame, onFinish: (detectionResults: ROI[]) => Promise<void>): Promise<void> {
    const result = await this.detect(frame);
    await onFinish(result);
  }
}
