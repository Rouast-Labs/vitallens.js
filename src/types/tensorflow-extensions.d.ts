import * as tf from '@tensorflow/tfjs';

declare module '@tensorflow/tfjs' {
  interface DataTypeMap extends tf.DataTypeMap {
    uint8: Uint8Array;
  }
}
