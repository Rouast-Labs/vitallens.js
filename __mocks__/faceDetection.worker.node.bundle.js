/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');

const realWorkerPath = path.resolve(
  __dirname,
  '../dist/faceDetection.worker.node.bundle.js'
);

const rawCode = fs.readFileSync(realWorkerPath, 'utf8');
const base64Code = Buffer.from(rawCode, 'utf8').toString('base64');
const dataUrl = `data:text/javascript;base64,${base64Code}`;

module.exports = dataUrl;
