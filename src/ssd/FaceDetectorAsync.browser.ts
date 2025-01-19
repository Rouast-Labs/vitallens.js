import * as tf from '@tensorflow/tfjs';
import { FaceDetectorAsyncBase } from "./FaceDetectorAsync.base";

// IMPORTANT: We import the base64-encoded files here,
// which Rollup will inline in the browser build
import modelJsonBase64 from '../../models/Ultra-Light-Fast-Generic-Face-Detector-1MB/model.json';
import modelBinBase64 from '../../models/Ultra-Light-Fast-Generic-Face-Detector-1MB/group1-shard1of1.bin';

export class FaceDetectorAsync extends FaceDetectorAsyncBase {
  /**
   * Loads the face detection model (browser).
   */
  protected async init(): Promise<void> {
    try {
      // Decode the model.json from base64
      const modelJsonBase64String = modelJsonBase64 as unknown as string;
      const jsonBase64 = modelJsonBase64String.split(',')[1];
      const jsonStr = atob(jsonBase64);
      const jsonObj = JSON.parse(jsonStr);

      // Decode the weights (.bin) from base64
      const binBase64 = modelBinBase64.split(',')[1];
      const raw = atob(binBase64);
      const buffer = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) {
        buffer[i] = raw.charCodeAt(i);
      }

      // Build ModelArtifacts
      // Typically you have modelTopology + weightManifest in the JSON
      // For an ultra-light face detector, there's usually just one manifest entry
      const weightSpecs = jsonObj.weightsManifest[0].weights;
      const modelArtifacts: tf.io.ModelArtifacts = {
        modelTopology: jsonObj.modelTopology ?? jsonObj, // depending on how it's structured
        weightSpecs,
        weightData: buffer.buffer,  // ArrayBuffer
        format: 'graph-model',
      };

      // Load from memory (no fetch calls)
      this.model = await tf.loadGraphModel(tf.io.fromMemory(modelArtifacts));
      console.log('Face detection model loaded in Browser environment!');
    } catch (error) {
      console.error('Failed to load the face detection model (Browser):', error);
    }
  }
}
