import * as tf from '@tensorflow/tfjs-core';

declare module '@tensorflow/tfjs-core' {
  interface DataTypeMap extends tf.DataTypeMap {
    uint8: Uint8Array;
  }
}
