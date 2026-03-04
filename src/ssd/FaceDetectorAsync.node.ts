import tf from 'tfjs-provider';
import { FaceDetectorAsyncBase } from './FaceDetectorAsync.base';
import fs from 'fs';
import path from 'path';
import { workerData } from 'worker_threads';
import { modelJsonPath, modelBinPath } from './modelAssets';

export class FaceDetectorAsync extends FaceDetectorAsyncBase {
  /**
   * Loads the face detection model (Node).
   */
  protected async init(): Promise<void> {
    try {
      // Fallback to process.cwd() just in case workerData isn't present in a test context
      const baseDir = workerData?.baseDir || process.cwd();

      // Resolve the path exported by Rollup/Vitest relative to the base directory
      const jsonPath = path.resolve(baseDir, modelJsonPath);
      const binPath = path.resolve(baseDir, modelBinPath);

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
