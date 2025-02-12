import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';

tf.setBackend('webgl');

export * from '@tensorflow/tfjs-core';
export default tf;
