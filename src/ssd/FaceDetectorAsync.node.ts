import tf from 'tfjs-provider';
import { FaceDetectorAsyncBase } from './FaceDetectorAsync.base';

// IMPORTANT: We import the base64-encoded files here, which Rollup will inline in the node build
import modelJsonBase64 from '../../models/Ultra-Light-Fast-Generic-Face-Detector-1MB/model.json';
import modelBinBase64 from '../../models/Ultra-Light-Fast-Generic-Face-Detector-1MB/group1-shard1of1.bin';

export class FaceDetectorAsync extends FaceDetectorAsyncBase {
  /**
   * Loads the face detection model (Node).
   */
  protected async init(): Promise<void> {
    try {
      // Decode the model.json
      const jsonBase64 = (modelJsonBase64 as unknown as string).split(',')[1];
      const jsonStr = Buffer.from(jsonBase64, 'base64').toString('utf-8');
      const jsonObj = JSON.parse(jsonStr);

      // Decode the binary weights file
      const binBase64 = modelBinBase64.split(',')[1];
      const buffer = Buffer.from(binBase64, 'base64');
      const uint8Array = new Uint8Array(buffer);

      // Prepare the ModelArtifacts object
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
