import tf from 'tfjs-provider';
import { FaceDetectorAsyncBase } from './FaceDetectorAsync.base';
import { modelJsonBase64, modelBinBase64 } from './modelAssets';

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
