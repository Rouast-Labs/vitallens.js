import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Only needed because this example links the library from the repo root via
// "file:../..". Apps installing vitallens from npm don't need any config.
export default {
  turbopack: { root },
  outputFileTracingRoot: root,
};
