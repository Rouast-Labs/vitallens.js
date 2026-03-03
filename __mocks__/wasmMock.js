import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Hardcode the absolute path to bypass Jest's moduleNameMapper loop
const wasmPath = path.resolve(__dirname, '../node_modules/vitallens-core/vitallens_core_bg.wasm');

// 2. Read the actual binary
const wasmBuffer = fs.readFileSync(wasmPath);

// 3. Export as Uint8Array (which vitallens-core init() natively accepts)
export default new Uint8Array(wasmBuffer);
