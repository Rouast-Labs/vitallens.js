import tf from 'tfjs-provider';
import { FaceDetectorAsyncBase } from './FaceDetectorAsync.base';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class FaceDetectorAsync extends FaceDetectorAsyncBase {
  /**
   * Loads the face detection model (Node).
   */
  protected async init(): Promise<void> {
    try {
      const jsonPath = path.resolve(
        __dirname,
        '../../models/Ultra-Light-Fast-Generic-Face-Detector-1MB/model.json'
      );
      const binPath = path.resolve(
        __dirname,
        '../../models/Ultra-Light-Fast-Generic-Face-Detector-1MB/group1-shard1of1.bin'
      );

      const jsonStr = fs.readFileSync(jsonPath, 'utf-8');
      const jsonObj = JSON.parse(jsonStr);

      const buffer = fs.readFileSync(binPath);
      const uint8Array = new Uint8Array(buffer);

      const weightSpecs = jsonObj.weightsManifest[0].weights;
      const modelArtifacts: tf.io.ModelArtifacts = {
        modelTopology: jsonObj.modelTopology ?? jsonObj,
        weightSpecs,
        weightData: uint8Array.buffer,
        format: 'graph-model',
      };

      this.model = await tf.loadGraphModel(tf.io.fromMemory(modelArtifacts));
    } catch (error) {
      console.error('Failed to load the face detection model (Node):', error);
    }
  }
}
