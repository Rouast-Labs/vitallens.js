import tf from 'tfjs-provider';
import { FaceDetectorAsyncBase } from './FaceDetectorAsync.base';
import { modelJsonPath, modelBinPath } from './modelAssets';
import { resolveAsset } from '../utils/assetResolver';

export class FaceDetectorAsync extends FaceDetectorAsyncBase {
  /**
   * Loads the face detection model (browser).
   */
  protected async init(): Promise<void> {
    try {
      const jsonUrl = resolveAsset(modelJsonPath);
      const binUrl = resolveAsset(modelBinPath);

      const [jsonResponse, binResponse] = await Promise.all([
        fetch(jsonUrl),
        fetch(binUrl),
      ]);

      const jsonObj = await jsonResponse.json();
      const binBuffer = await binResponse.arrayBuffer();

      const weightSpecs = jsonObj.weightsManifest[0].weights;
      const modelArtifacts: tf.io.ModelArtifacts = {
        modelTopology: jsonObj.modelTopology ?? jsonObj,
        weightSpecs,
        weightData: binBuffer,
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
