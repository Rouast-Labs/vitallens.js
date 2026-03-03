import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const realModelBinPath = path.resolve(
  __dirname,
  '../models/Ultra-Light-Fast-Generic-Face-Detector-1MB/group1-shard1of1.bin'
);
const rawBin = fs.readFileSync(realModelBinPath);
const base64Bin = rawBin.toString('base64');
const dataUrl = `data:application/octet-stream;base64,${base64Bin}`;

export default dataUrl;
