import * as tf from '@tensorflow/tfjs';
import { FaceDetectorAsyncBase } from './FaceDetectorAsync.base';
import { modelJsonBase64, modelBinBase64 } from './modelAssets';

export class FaceDetectorAsync extends FaceDetectorAsyncBase {
  /**
   * Loads the face detection model (browser).
   */
  protected async init(): Promise<void> {
    try {
      // Decode the model.json from base64
      const jsonBase64 = (modelJsonBase64 as unknown as string).split(',')[1];
      const jsonStr = atob(jsonBase64);
      const jsonObj = JSON.parse(jsonStr);

      // Decode the weights (.bin) from base64
      const binBase64 = modelBinBase64.split(',')[1];
      const raw = atob(binBase64);
      const buffer = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) {
        buffer[i] = raw.charCodeAt(i);
      }

      const weightSpecs = jsonObj.weightsManifest[0].weights;
      const modelArtifacts: tf.io.ModelArtifacts = {
        modelTopology: jsonObj.modelTopology ?? jsonObj,
        weightSpecs,
        weightData: buffer.buffer,
        format: 'graph-model',
      };

      this.model = await tf.loadGraphModel(tf.io.fromMemory(modelArtifacts));
    } catch (error) {
      console.error(
        'Failed to load the face detection model (Browser):',
        error
      );
    }
  }
}
