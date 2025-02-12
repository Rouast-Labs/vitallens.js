import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';

tf.setBackend('cpu').then(() => {
  console.log('tfjs backend is:', tf.getBackend());
});

export * from '@tensorflow/tfjs-core';
export default tf;
