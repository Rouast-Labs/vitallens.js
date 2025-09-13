import tf from 'tfjs-provider';
import { Frame } from '../processing/Frame';
import { ROI, VideoInput, VideoProbeResult } from '../types/core';
import { IFaceDetector } from '../types/IFaceDetector';
import { IFFmpegWrapper } from '../types/IFFmpegWrapper';

const DET_WIDTH = 320;
const DET_HEIGHT = 240;
const DET_CHANNELS = 3;

/**
 * The face detector input can be either a pre-processed Frame or a VideoInput.
 */
export type FaceDetectorInput = Frame | VideoInput;

/**
 * Information recorded for each frame.
 */
export interface DetectionInfo {
  frameIndex: number;
  scanned: boolean;
  faceFound: boolean;
  interpValid: boolean;
  confidence: number;
  roi?: ROI;
}

/**
 * Custom Non-Max Suppression implementation that wraps the optimized TensorFlow.js function.
 * @param boxes - An array of bounding boxes [xMin, yMin, xMax, yMax].
 * @param scores - An array of confidence scores for each box.
 * @param maxOutputSize - The maximum number of boxes to return.
 * @param iouThreshold - The IOU threshold for filtering overlapping boxes.
 * @param scoreThreshold - The score threshold for filtering low-confidence boxes.
 * @returns A Promise resolving to the indices of selected boxes.
 */
export async function nms(
  boxes: number[][],
  scores: number[],
  maxOutputSize: number,
  iouThreshold: number,
  scoreThreshold: number
): Promise<number[]> {
  // The function is now async and returns a Promise
  if (boxes.length === 0) {
    return [];
  }

  // Tensors that will be created and must be disposed
  let boxesTensor: tf.Tensor2D | null = null;
  let scoresTensor: tf.Tensor1D | null = null;
  let swappedBoxesTensor: tf.Tensor2D | null = null;
  let selectedIndicesTensor: tf.Tensor1D | null = null;

  try {
    // 1. Convert the standard JavaScript arrays into TensorFlow.js Tensors.
    boxesTensor = tf.tensor2d(boxes, [boxes.length, 4]);
    scoresTensor = tf.tensor1d(scores);

    // 2. IMPORTANT: Swap coordinate order from your [xMin, yMin, xMax, yMax]
    //    to TensorFlow's required [yMin, xMin, yMax, xMax] format.
    swappedBoxesTensor = tf.gather(boxesTensor, [1, 0, 3, 2], 1) as tf.Tensor2D;

    // 3. Call the highly optimized, native TensorFlow.js NMS function.
    selectedIndicesTensor = await tf.image.nonMaxSuppressionAsync(
      swappedBoxesTensor,
      scoresTensor,
      maxOutputSize,
      iouThreshold,
      scoreThreshold
    );

    // 4. Convert the resulting Tensor of indices back into a standard JavaScript array.
    const selectedIndices = await selectedIndicesTensor.array();

    // 5. Return the final array of indices.
    return selectedIndices;
  } finally {
    // 6. Clean up all created tensors to prevent GPU memory leaks.
    boxesTensor?.dispose();
    scoresTensor?.dispose();
    swappedBoxesTensor?.dispose();
    selectedIndicesTensor?.dispose();
  }
}

/**
 * Face detector class, implementing detection via a machine learning model.
 */
export abstract class FaceDetectorAsyncBase implements IFaceDetector {
  protected model: tf.GraphModel | null = null;
  private loaded = false;
  private loadingPromise: Promise<void> | null = null;

  /**
   * @param maxFaces The maximum number of faces to detect.
   * @param scoreThreshold Confidence threshold.
   * @param iouThreshold IOU threshold.
   */
  constructor(
    private maxFaces: number = 1,
    private scoreThreshold: number = 0.5,
    private iouThreshold: number = 0.3
  ) {}

  /**
   * Subclasses must initialize the model appropriately.
   */
  protected abstract init(): Promise<void>;

  /**
   * Public method to ensure the model is fully loaded before detection.
   */
  public async load(): Promise<void> {
    if (this.loaded) return;
    if (!this.loadingPromise) {
      this.loadingPromise = this.init().then(() => {
        this.loaded = true;
      });
    }
    await this.loadingPromise;
  }

  /**
   * Processes a single batch of frames.
   * @param input - Either a preloaded Frame or a VideoInput file.
   * @param batchFrameIndices - An array of original frame indices to process in this batch.
   * @param ffmpeg - The ffmpeg wrapper (required for VideoInput).
   * @param probeInfo - Probe information about the video (required for VideoInput).
   * @returns An array of DetectionInfo for the frames in the batch.
   */
  private async processBatch(
    input: FaceDetectorInput,
    batchFrameIndices: number[],
    ffmpeg?: IFFmpegWrapper,
    probeInfo?: VideoProbeResult
  ): Promise<DetectionInfo[]> {
    let frame: Frame;

    if (input instanceof Frame) {
      frame = input;
    } else {
      // For VideoInput, call ffmpeg to read only this batch's frames.
      if (!ffmpeg || !probeInfo) {
        throw new Error('ffmpeg and probeInfo are required for VideoInput.');
      }
      // The batchFrameIndices are original frame indices.
      // Determine the trim boundaries.
      const batchStart = batchFrameIndices[0];
      const batchEnd = batchFrameIndices[batchFrameIndices.length - 1];
      const fs = probeInfo.fps / (batchFrameIndices[1] - batchFrameIndices[0]);
      const videoBuffer = await ffmpeg.readVideo(
        input,
        {
          fpsTarget: fs,
          scale: { width: DET_WIDTH, height: DET_HEIGHT },
          trim: { startFrame: batchStart, endFrame: batchEnd + 1 },
        },
        probeInfo
      );
      // Create a Frame from the loaded video buffer.
      frame = Frame.fromUint8Array(videoBuffer, [
        batchFrameIndices.length,
        DET_HEIGHT,
        DET_WIDTH,
        DET_CHANNELS,
      ]);
    }

    // Ensure the tensor is normalized float resized to the expected dimensions.
    const inputs = tf.tidy(() => {
      const frameData = frame.getTensor();
      const x = (
        frameData.rank === 3 ? tf.expandDims(frameData) : frameData
      ) as tf.Tensor4D;
      return tf.image
        .resizeBilinear(x.toFloat(), [DET_HEIGHT, DET_WIDTH])
        .sub(127.0)
        .div(128.0);
    });

    // Run inference on the batch.
    const outputs = (await this.model!.executeAsync(inputs)) as tf.Tensor;
    inputs.dispose();

    // Extract detection boxes and scores as Arrays
    const detectionInfos: DetectionInfo[] = [];
    const { allBoxesArray, allScoresArray } = tf.tidy(() => {
      const boxes = tf.slice(outputs, [0, 0, 2], [-1, -1, 4]);
      const scores = tf.slice(outputs, [0, 0, 1], [-1, -1, 1]).squeeze([-1]);
      const allBoxesArray = boxes.arraySync() as number[][][];
      const allScoresArray = scores.arraySync() as number[][];
      return { allBoxesArray, allScoresArray };
    });
    outputs.dispose();

    // For each frame in the batch, run NMS and record detection info.
    for (let i = 0; i < batchFrameIndices.length; i++) {
      const origFrameIndex = batchFrameIndices[i];
      const frameBoxes = allBoxesArray[i]; // (N_ANCHORS, 4)
      const frameScores = allScoresArray[i]; // (N_ANCHORS,)

      // Run non-max suppression.
      const nmsIndices = await nms(
        frameBoxes,
        frameScores,
        this.maxFaces,
        this.iouThreshold,
        this.scoreThreshold
      );

      // Compile detection info.
      let roi: ROI | null = null;
      let confidence = 0;
      let faceFound = false;
      if (nmsIndices.length > 0) {
        const selectedBox = frameBoxes[nmsIndices[0]];
        const [xMin, yMin, xMax, yMax] = selectedBox;
        roi = { x0: xMin, y0: yMin, x1: xMax, y1: yMax };
        confidence = frameScores[nmsIndices[0]];
        faceFound = true;
      }
      detectionInfos.push({
        frameIndex: origFrameIndex,
        scanned: true,
        faceFound,
        interpValid: false,
        confidence,
        roi: roi || undefined,
      });
    }
    return detectionInfos;
  }

  /**
   * Runs face detection on the provided input (Frame or VideoInput) and returns an array
   * of ROIs (one per frame in the original video).
   * @param input - The input Frame or VideoInput.
   * @param fs - frequency (Hz) at which to scan frames.
   * @param ffmpeg - An FFmpegWrapper (only required if input is VideoInput).
   * @param probeInfo - Info about the input (only required if input is VideoInput).
   * @returns A promise resolving to an array of ROIs.
   */
  async detect(
    input: FaceDetectorInput,
    fs: number,
    ffmpeg?: IFFmpegWrapper,
    probeInfo?: VideoProbeResult
  ): Promise<ROI[]> {
    if (!this.loaded || !this.model) {
      throw new Error(
        'Face detection model is not loaded. Call .load() first.'
      );
    }

    // Prepare variables for inference
    const maxBatchFrames = 100;
    let totalFrames: number;
    let scannedFrameIndices: number[];
    let dsFactor: number | undefined = undefined;

    if (input instanceof Frame) {
      // If a Frame is passed, use it directly.
      const shape = input.getShape();
      if (shape.length === 3) {
        totalFrames = 1;
        scannedFrameIndices = [0];
      } else {
        totalFrames = shape[0];
        // Assume that all frames in the batch should be scanned.
        scannedFrameIndices = Array.from({ length: totalFrames }, (_, i) => i);
      }
      // frame = input;
    } else {
      // A VideoInput was passed – we must use ffmpeg to load the video.
      if (!ffmpeg || !probeInfo) {
        throw new Error(
          'ffmpeg wrapper instance and probeInfo are required if providing VideoInput.'
        );
      }
      // Probe the video to obtain fps and total frames.
      const videoFps = probeInfo.fps;
      totalFrames = probeInfo.totalFrames;
      // Compute downsampling factor (dsFactor) from video fps and desired scan frequency.
      dsFactor = Math.max(Math.round(videoFps / fs), 1);
      const scannedFramesCount = Math.ceil(totalFrames / dsFactor);
      scannedFrameIndices = Array.from(
        { length: scannedFramesCount },
        (_, i) => i * dsFactor!
      );
    }

    // Split the scanned frame indices into batches.
    let detectionInfos: DetectionInfo[] = [];
    if (scannedFrameIndices.length <= maxBatchFrames) {
      const batchInfos = await this.processBatch(
        input,
        scannedFrameIndices,
        ffmpeg,
        probeInfo
      );
      detectionInfos = detectionInfos.concat(batchInfos);
    } else {
      const nBatches = Math.ceil(scannedFrameIndices.length / maxBatchFrames);
      for (let batch = 0; batch < nBatches; batch++) {
        const startIndex = batch * maxBatchFrames;
        const endIndex = Math.min(
          startIndex + maxBatchFrames,
          scannedFrameIndices.length
        );
        const batchFrameIndices = scannedFrameIndices.slice(
          startIndex,
          endIndex
        );
        const batchInfos = await this.processBatch(
          input,
          batchFrameIndices,
          ffmpeg,
          probeInfo
        );
        detectionInfos = detectionInfos.concat(batchInfos);
      }
    }

    // "Backfill" unscanned frames via linear interpolation.
    const finalROIs = this.interpolateDetections(detectionInfos, totalFrames);
    return finalROIs;
  }

  /**
   * Interpolates detections for frames that were not scanned. For each frame index
   * from 0 to totalFrames-1, if no detection is available, linearly interpolate ROI
   * coordinates from the nearest previous and next valid (faceFound) detections.
   * @param detections - The array of DetectionInfo from scanned frames.
   * @param totalFrames - The total number of frames in the original video.
   * @returns An ROI for every frame (backfilled by interpolation where necessary).
   */
  private interpolateDetections(
    detections: DetectionInfo[],
    totalFrames: number
  ): ROI[] {
    // Map detections by their frame index.
    const detectionMap = new Map<number, DetectionInfo>();
    detections.forEach((det) => detectionMap.set(det.frameIndex, det));

    const finalROIs: ROI[] = [];

    // Simple helper to interpolate between two ROIs.
    const interpolateROI = (roi1: ROI, roi2: ROI, t: number): ROI => ({
      x0: roi1.x0 * (1 - t) + roi2.x0 * t,
      y0: roi1.y0 * (1 - t) + roi2.y0 * t,
      x1: roi1.x1 * (1 - t) + roi2.x1 * t,
      y1: roi1.y1 * (1 - t) + roi2.y1 * t,
    });

    // Get sorted scanned frame indices.
    const scannedIndices = Array.from(detectionMap.keys()).sort(
      (a, b) => a - b
    );

    // For every frame in the original video...
    for (let i = 0; i < totalFrames; i++) {
      if (detectionMap.has(i)) {
        // Use the detection from the scanned frame.
        const det = detectionMap.get(i)!;
        finalROIs.push(det.roi ? det.roi : { x0: 0, y0: 0, x1: 0, y1: 0 });
      } else {
        // Find the nearest previous and next scanned frames with a valid detection.
        let prevIndex = -1;
        let nextIndex = -1;
        for (let j = scannedIndices.length - 1; j >= 0; j--) {
          if (scannedIndices[j] < i) {
            const det = detectionMap.get(scannedIndices[j]);
            if (det && det.faceFound && det.roi) {
              prevIndex = scannedIndices[j];
              break;
            }
          }
        }
        for (let j = 0; j < scannedIndices.length; j++) {
          if (scannedIndices[j] > i) {
            const det = detectionMap.get(scannedIndices[j]);
            if (det && det.faceFound && det.roi) {
              nextIndex = scannedIndices[j];
              break;
            }
          }
        }
        let interpROI: ROI;
        if (prevIndex !== -1 && nextIndex !== -1) {
          const detPrev = detectionMap.get(prevIndex)!;
          const detNext = detectionMap.get(nextIndex)!;
          const t = (i - prevIndex) / (nextIndex - prevIndex);
          interpROI = interpolateROI(detPrev.roi!, detNext.roi!, t);
        } else if (prevIndex !== -1) {
          interpROI = detectionMap.get(prevIndex)!.roi!;
        } else if (nextIndex !== -1) {
          interpROI = detectionMap.get(nextIndex)!.roi!;
        } else {
          // No valid detections available – return a default ROI.
          interpROI = { x0: 0, y0: 0, x1: 0, y1: 0 };
        }
        finalROIs.push(interpROI);
      }
    }
    return finalROIs;
  }
}
