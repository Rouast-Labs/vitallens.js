import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const realWorkerPath = path.resolve(
  __dirname,
  '../dist/faceDetection.worker.node.bundle.js'
);

const rawCode = fs.readFileSync(realWorkerPath, 'utf8');
const base64Code = Buffer.from(rawCode, 'utf8').toString('base64');
const dataUrl = `data:text/javascript;base64,${base64Code}`;

export default dataUrl;
