import * as tf from '@tensorflow/tfjs-node';
import { FaceDetectorAsyncBase } from "./FaceDetectorAsync.base";
import path from 'path';

export class FaceDetectorAsync extends FaceDetectorAsyncBase {
  /**
   * Loads the face detection model (Node).
   */
  protected async init(): Promise<void> {
    try {
      // Compute the absolute path to the model JSON using process.cwd().
      // This assumes that when running your package, the current working directory is the package root.
      const modelJsonPath = path.join(process.cwd(), 'models', 'Ultra-Light-Fast-Generic-Face-Detector-1MB', 'model.json');
      // tf.loadGraphModel expects a file URL with the "file://" protocol.
      this.model = await tf.loadGraphModel(`file://${modelJsonPath}`);
    } catch (error) {
      console.error('Failed to load the face detection model (Node):', error);
    }
  }
}
