/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-require-imports */
const { Blob } = require('fetch-blob');

if (typeof globalThis.Blob === 'undefined') {
  globalThis.Blob = Blob;
}
