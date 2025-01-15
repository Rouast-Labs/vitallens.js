import { Frame } from "../processing/Frame";
import { ROI } from "../types/core";
import { IFaceDetector } from "../types/IFaceDetector";

/**
 * Interface for a face detection result.
 */
interface FaceDetectionResult {
  faceFound: boolean;
  boundingBox: ROI;
}

export class FaceDetector implements IFaceDetector {
  private maxFaces: number = 1;
  private scoreThreshold: number = 0.5;
  private iouThreshold: number = 0.3;

  /**
   * Initializes the face detector with configuration.
   * @param maxFaces - Maximum number of faces to detect.
   * @param fps - Target frames per second.
   * @param scoreThreshold - Minimum confidence score for a detection.
   * @param iouThreshold - Minimum IoU for non-max suppression.
   */
  async init(maxFaces: number, fps: number, scoreThreshold: number, iouThreshold: number): Promise<void> {
    this.maxFaces = maxFaces;
    this.scoreThreshold = scoreThreshold;
    this.iouThreshold = iouThreshold;

    // TODO: Load face detection model (e.g., BlazeFace, SSD MobileNet)
    console.log(`FaceDetector initialized with maxFaces=${maxFaces}, fps=${fps}, scoreThreshold=${scoreThreshold}, iouThreshold=${iouThreshold}`);
  }

  // Define the function for face detection
  run(frame: Frame, fps: number, onFinish: (detectionResult: any) => Promise<void>): void {
    frame.retain(); // 2 (or 1 if already released by loop)
    try {
      const detectionResult: FaceDetectionResult = {
        faceFound: true,
        boundingBox: { x: 100, y: 50, width: 200, height: 200 },
      };
      onFinish(detectionResult); // Execute the callback with the result
    } finally {
      frame.release(); // 1 (or 0 if already released by loop)
    }
  }
}
