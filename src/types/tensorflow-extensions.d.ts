import * as tfCore from '@tensorflow/tfjs-core';

declare module '@tensorflow/tfjs-core' {
  // Extend the existing interface using the imported alias.
  interface DataTypeMap extends tfCore.DataTypeMap {
    uint8: Uint8Array;
  }
}
