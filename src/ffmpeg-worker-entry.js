// This entry file’s only job is to import ffmpeg-wasm’s worker
// so that Rollup can bundle it (including its relative imports)
// into one self-contained file.
export * from '@ffmpeg/ffmpeg/dist/esm/worker.js';
