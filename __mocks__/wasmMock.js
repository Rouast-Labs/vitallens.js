import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const wasmPath = path.resolve(__dirname, '../node_modules/vitallens-core/vitallens_core_bg.wasm');
const wasmBuffer = fs.readFileSync(wasmPath);

export default new Uint8Array(wasmBuffer);
