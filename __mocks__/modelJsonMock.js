import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const realModelJsonPath = path.resolve(
  __dirname,
  '../models/Ultra-Light-Fast-Generic-Face-Detector-1MB/model.json'
);
const rawJson = fs.readFileSync(realModelJsonPath, 'utf8');
const base64Json = Buffer.from(rawJson, 'utf8').toString('base64');
const dataUrl = `data:application/json;base64,${base64Json}`;

export default dataUrl;
