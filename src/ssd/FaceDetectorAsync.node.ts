import * as tf from '@tensorflow/tfjs';
// Or import '@tensorflow/tfjs-node' in your test environment if you need the native bindings.
import { FaceDetectorAsyncBase } from "./FaceDetectorAsync.base";

import * as path from 'path';

export class FaceDetectorAsync extends FaceDetectorAsyncBase {
  /**
   * Loads the face detection model (Node).
   */
  protected async init(): Promise<void> {
    try {
      // Example: the model files are in ../../models/Ultra-Light-Fast-Generic-Face-Detector-1MB
      const modelJsonPath = path.resolve(__dirname, '../../models/Ultra-Light-Fast-Generic-Face-Detector-1MB/model.json');
      this.model = await tf.loadGraphModel(`file://${modelJsonPath}`);

      // Note: If model.json references the shard .bin in the same folder,
      // tfjs-node will automatically load it from the same directory.

      console.log('Face detection model loaded in Node environment!');
    } catch (error) {
      console.error('Failed to load the face detection model (Node):', error);
    }
  }
}
