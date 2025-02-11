/* eslint-disable @typescript-eslint/no-unused-vars */

import { StreamProcessorBase } from './StreamProcessor.base';
import { Frame } from './Frame';

/**
 * Node-specific stub implementation of the StreamProcessor.
 * Currently, face detection is not fully implemented.
 * This class exists to compile and run without errors,
 * and can be extended later with actual worker-based face detection using worker_threads.
 */
export class StreamProcessor extends StreamProcessorBase {
  private faceDetectionRequestId: number = 0;

  /**
   * Triggers face detection on a single frame.
   * In this stub, we simply log a warning and release the frame.
   * (Later, implement sending frame data to a Node worker.)
   * @param frame - The current frame to detect a face in.
   * @param currentTime - Timestamp in seconds.
   */
  protected triggerFaceDetection(frame: Frame, currentTime: number): void {
    console.warn(
      'Node triggerFaceDetection stub: not implemented. Skipping face detection.'
    );
    // In a full implementation, you would send frame data to the worker here.
    frame.release();
  }

  /**
   * Handles worker responses with face detection results.
   * This stub simply logs the call.
   * (Later, implement actual result processing similar to the browser version.)
   * @param data - The data received from the worker.
   */
  protected handleFaceDetectionResult(data: unknown): void {
    console.warn(
      'Node handleFaceDetectionResult stub called; no processing performed.',
      data
    );
    // In a full implementation, you would update the ROI and call onNoFace() as needed.
  }
}
