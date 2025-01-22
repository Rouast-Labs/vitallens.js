import * as tf from '@tensorflow/tfjs';
import { Frame } from "../processing/Frame";
import { ROI } from "../types/core";
import { IFaceDetector } from "../types/IFaceDetector";

/**
 * Custom Non-Max Suppression implementation.
 * 
 * @param boxes - An array of bounding boxes [xMin, yMin, xMax, yMax].
 * @param scores - An array of confidence scores for each box.
 * @param maxOutputSize - The maximum number of boxes to return.
 * @param iouThreshold - The IOU threshold for filtering overlapping boxes.
 * @param scoreThreshold - The score threshold for filtering low-confidence boxes.
 * @returns Indices of selected boxes and the count of valid boxes.
 */
export function nms(
  boxes: number[][],
  scores: number[],
  maxOutputSize: number,
  iouThreshold: number,
  scoreThreshold: number
): number[] {
  const areas = boxes.map(([x1, y1, x2, y2]) => (x2 - x1) * (y2 - y1));
  const sortedIndices = scores
    .map((score, index) => ({ score, index }))
    .filter(({ score }) => score >= scoreThreshold) // Filter by score threshold
    .sort((a, b) => b.score - a.score) // Sort by score descending
    .map(({ index }) => index);

  const selectedIndices: number[] = [];

  while (sortedIndices.length > 0 && selectedIndices.length < maxOutputSize) {
    const current = sortedIndices.shift()!;
    selectedIndices.push(current);

    const [x1, y1, x2, y2] = boxes[current];
    const overlaps = sortedIndices.filter((index) => {
      const [xx1, yy1, xx2, yy2] = boxes[index];
      const interX1 = Math.max(x1, xx1);
      const interY1 = Math.max(y1, yy1);
      const interX2 = Math.min(x2, xx2);
      const interY2 = Math.min(y2, yy2);

      const interArea = Math.max(0, interX2 - interX1) * Math.max(0, interY2 - interY1);
      const unionArea = areas[current] + areas[index] - interArea;
      const iou = interArea / unionArea;

      return iou <= iouThreshold;
    });

    // Keep indices that do not overlap significantly
    sortedIndices.length = 0;
    sortedIndices.push(...overlaps);
  }

  return selectedIndices;
}

/**
 * Face detector class, implementing detection via a machine learning model.
 */
export abstract class FaceDetectorAsyncBase implements IFaceDetector {
  protected model: tf.GraphModel | null = null;

  constructor(
    private maxFaces: number = 1,
    private scoreThreshold: number = 0.5,
    private iouThreshold: number = 0.3
  ) {
    this.init();
  }

  /**
   * Subclasses must init the model appropriately.
   */
  protected abstract init(): Promise<void>;

  /**
   * Runs face detection on the provided frame and returns an array of ROIs.
   * @param frame - The input frame containing a batch of images as a Tensor4D.
   * @returns A promise resolving to an array of detected ROIs.
   */
  async detect(frame: Frame): Promise<ROI[]> {
    if (!this.model) {
      throw new Error("Face detection model is not loaded.");
    }
  
    const nFrames = frame.getShape().length === 3 ? 1 : frame.getShape()[0];

    // Model inputs (N_FRAMES, 240, 320, 3) 
    const inputs = tf.tidy(() => {
      const frameData = frame.getTensor();
      let x;
      if (frameData.rank === 3) {
        x = tf.expandDims(frameData.toFloat().sub(127.0).div(128.0), 0);
      } else {
        x = frameData.toFloat().sub(127.0).div(128.0);
      }
      // Resize to input size
      return tf.image.resizeBilinear(x as tf.Tensor4D, [240, 320]);
    });

    // Perform inference (N_FRAMES, N_ANCHORS, 6)
    const outputs = (await this.model.executeAsync(inputs)) as tf.Tensor;

    inputs.dispose();

    // Extract information from outputs and convert to arrays
    // allBoxesArray (N_FRAMES, N_ANCHORS, 4)
    // allScoresArray (N_FRAMES, N_ANCHORS, 1)
    const { allBoxesArray, allScoresArray } = tf.tidy(() => {
      const boxes = tf.slice(outputs, [0, 0, 2], [-1, -1, 4]); // Clone if needed
      const scores = tf.slice(outputs, [0, 0, 1], [-1, -1, 1]).squeeze([-1]);
      // Convert tensors to arrays synchronously
      const allBoxesArray = boxes.arraySync() as number[][][];
      const allScoresArray = scores.arraySync() as number[][];
      return { allBoxesArray, allScoresArray };
    });

    // TODO: If disposing, will fail for subsequent detect() falls
    // outputs.dispose();

    // Process each frame using TypeScript arrays
    const selectedBoxes: ROI[] = [];
    for (let i = 0; i < nFrames; i++) {
      const frameBoxes = allBoxesArray[i]; // Shape: [N_ANCHORS, 4]
      const frameScores = allScoresArray[i]; // Shape: [N_ANCHORS]
      
      // Perform NMS using the arrays
      const nmsIndices = nms(frameBoxes, frameScores, this.maxFaces, this.iouThreshold, this.scoreThreshold);

      // Gather the selected boxes
      const selectedFrameBoxes = nmsIndices.map((index) => {
        const [xMin, yMin, xMax, yMax] = frameBoxes[index];
        return {
          x: xMin,
          y: yMin,
          width: xMax - xMin,
          height: yMax - yMin,
        };
      });

      selectedBoxes.push(...selectedFrameBoxes);
    }

    return selectedBoxes;
  }

  /**
   * Runs detection and invokes the callback with the results.
   * @param frame - The input frame for face detection.
   * @param onFinish - Callback to handle the detection results.
   */
  async run(frame: Frame, onFinish: (detectionResults: ROI[]) => Promise<void>): Promise<void> {
    const detections: ROI[] = await this.detect(frame);
    console.log(detections);
    await onFinish(detections);
  }
}
