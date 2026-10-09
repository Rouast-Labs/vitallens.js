// TODO: TF.js is a heavy peer dependency used only for the face detector, basic tensor ops and
//   resizing, and appears to be in maintenance mode. Consider moving tensor/frame ops to plain typed
//   arrays or vitallens-core (WASM), and face detection to MediaPipe Tasks Vision or ONNX Runtime Web,
//   so the dependency can be dropped.
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';

tf.setBackend('webgl');

export * from '@tensorflow/tfjs-core';
export default tf;
