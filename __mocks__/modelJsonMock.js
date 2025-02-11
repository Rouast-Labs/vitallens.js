/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');

const realModelJsonPath = path.resolve(
  __dirname,
  '../models/Ultra-Light-Fast-Generic-Face-Detector-1MB/model.json'
);
const rawJson = fs.readFileSync(realModelJsonPath, 'utf8');
const base64Json = Buffer.from(rawJson, 'utf8').toString('base64');
const dataUrl = `data:application/json;base64,${base64Json}`;

module.exports = dataUrl;
