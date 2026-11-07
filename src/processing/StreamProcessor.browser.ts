import { StreamProcessorBase } from './StreamProcessor.base';
import { Frame } from './Frame';
import { checkROIValid, getROIForMethod } from '../utils/faceOps';
import { getCoreSync } from '../core/wasmProvider';
import type { FaceHold } from 'vitallens-core';

export class StreamProcessor extends StreamProcessorBase {
  private faceDetectionRequestId: number = 0;
  private faceHold: FaceHold | null = null;

  /**
   * Registers a detection result with vitallens-core's FaceHold.
   * @param det - The detected face, or null if none was found.
   * @param timestamp - Time of the detected frame in seconds.
   * @returns Whether a face is still considered present.
   */
  private holdFace(
    det: { x0: number; y0: number; x1: number; y1: number } | null,
    timestamp: number
  ): boolean {
    if (!this.faceHold) {
      this.faceHold = new (getCoreSync().FaceHold)(undefined);
    }
    const face = det
      ? { x: det.x0, y: det.y0, width: det.x1 - det.x0, height: det.y1 - det.y0 }
      : null;
    return this.faceHold.update(face, timestamp) != null;
  }

  /**
   * Clears the ROI, buffers and the held face.
   */
  reset(): void {
    super.reset();
    this.faceHold?.reset();
  }

  /**
   * Triggers face detection on a single frame.
   * @param frame - Current frame to detect face in.
   * @param currentTime - Timestamp in seconds.
   */
  protected triggerFaceDetection(frame: Frame, currentTime: number): void {
    if (!this.faceDetectionWorker) {
      throw new Error('Face detection worker does not exist.');
    }

    this.isDetecting = true;

    // Create a plain object that contains all data needed to reconstruct the Frame.
    const transferableData = frame.toTransferable();
    const requestId = this.faceDetectionRequestId++;
    const transferables: Transferable[] = [];

    // Ensure the rawData (an ArrayBuffer) is transferred.
    if (transferableData.rawData) {
      transferables.push(transferableData.rawData);
    }

    this.faceDetectionWorker.postMessage(
      {
        id: requestId,
        data: transferableData,
        dataType: 'frame',
        fs: 1, // Not used
        timestamp: currentTime,
      },
      transferables
    );

    // Release the frame immediately (its transferable data has been sent).
    frame.release();
  }

  /**
   * Handles worker responses with face detection results.
   * @param event - The detection event.
   */
  protected handleFaceDetectionResult(event: MessageEvent): void {
    const { id, detections, probeInfo, timestamp, error } = event.data;

    this.isDetecting = false;

    if (error) {
      console.error(`Face detection error (id: ${id}):`, error);
      // Error replies carry no timestamp. Use the current time to keep the 1 Hz retry cadence.
      this.lastFaceDetectionTime = performance.now() / 1000;
      this.registerDetectionError();
      return;
    }

    this.lastFaceDetectionTime = timestamp;
    this.registerDetectionSuccess();
    // The first reply waits for the model to load, so it is not a round trip.
    if (id > 0 && typeof timestamp === 'number') {
      this.detectorHooks?.report?.(
        'detection',
        performance.now() - timestamp * 1000
      );
    }

    const hasValidDetection =
      detections && detections.length > 0 && checkROIValid(detections[0]);

    if (!hasValidDetection) {
      // A miss keeps the current ROI until no face was found for the hold time
      if (this.holdFace(null, timestamp)) return;
      // No face detected.
      this.roi = null;
      this.pendingRoi = null;
      this.bufferManager.cleanup();
      this.onNoFace();
      return;
    }
    // Use the first detection
    const det = detections[0];
    this.holdFace(det, timestamp);

    if (this.onFaceDetected) {
      this.onFaceDetected({
        coordinates: [det.x0, det.y0, det.x1, det.y1],
        confidence: det.confidence ?? 1.0,
      });
    }

    if (checkROIValid(det)) {
      const newRoi = getROIForMethod(
        det,
        this.methodConfig,
        { height: probeInfo.height, width: probeInfo.width },
        true
      );

      const activeRoi = this.bufferManager.processTarget(
        newRoi,
        timestamp,
        this.methodConfig
      );
      if (activeRoi) {
        this.pendingRoi = activeRoi;
      }
    }
  }
}
