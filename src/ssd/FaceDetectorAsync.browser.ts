import tf from 'tfjs-provider';
import { FaceDetectorAsyncBase } from './FaceDetectorAsync.base';
import { modelJsonPath, modelBinPath } from './modelAssets';
import { resolveAsset } from '../utils/assetResolver';

export class FaceDetectorAsync extends FaceDetectorAsyncBase {
  constructor(
    maxFaces: number = 1,
    scoreThreshold: number = 0.5,
    iouThreshold: number = 0.3,
    private jsonUrl?: string,
    private binUrl?: string
  ) {
    super(maxFaces, scoreThreshold, iouThreshold);
  }

  protected async init(): Promise<void> {
    try {
      const finalJsonUrl = this.jsonUrl || resolveAsset(modelJsonPath);
      const finalBinUrl = this.binUrl || resolveAsset(modelBinPath);

      const [jsonResponse, binResponse] = await Promise.all([
        fetch(finalJsonUrl),
        fetch(finalBinUrl),
      ]);

      if (!jsonResponse.ok)
        throw new Error(
          `Failed to fetch JSON: ${jsonResponse.status} ${jsonResponse.statusText}`
        );
      if (!binResponse.ok)
        throw new Error(
          `Failed to fetch BIN: ${binResponse.status} ${binResponse.statusText}`
        );

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
