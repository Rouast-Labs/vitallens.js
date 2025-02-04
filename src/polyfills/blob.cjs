/* eslint-disable no-undef */

import { Blob } from 'fetch-blob';

if (typeof globalThis.Blob === 'undefined') {
  globalThis.Blob = Blob;
}
