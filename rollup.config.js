import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import url from '@rollup/plugin-url';
import { terser } from 'rollup-plugin-terser';
import json from '@rollup/plugin-json';
import alias from '@rollup/plugin-alias';
import path from 'path';

function onwarn(warning, defaultHandler) {
  // Ignore "`this` has been rewritten to `undefined`" warnings.
  // It's common in older TS-compiled code and doesn't break anything.
  if (warning.code === 'THIS_IS_UNDEFINED') return;
  
  // Otherwise, use Rollup's default warning handler.
  defaultHandler(warning);
}

const nodeEsmConfig = {
  input: 'src/index.node.ts',
  output: {
    file: 'dist/vitallens.esm.js',
    format: 'esm',
    sourcemap: true,
    inlineDynamicImports: true,
  },
  onwarn,
  plugins: [
    typescript(),
    json(),
    nodeResolve({ browser: false, preferBuiltins: true }),
    commonjs(),
    terser(),
  ],
}

const nodeCjsConfig = {
  input: 'src/index.node.ts',
  output: {
    file: 'dist/vitallens.cjs.js',
    format: 'cjs',
    sourcemap: true,
    inlineDynamicImports: true,
  },
  onwarn,
  plugins: [
    typescript(),
    json(),
    nodeResolve({ browser: false, preferBuiltins: true }),
    commonjs(),
    terser(),
  ],
}

const browserConfig = {
  input: 'src/index.browser.ts',
  output: {
    file: 'dist/vitallens.browser.js',
    format: 'esm',
    sourcemap: true,
    inlineDynamicImports: true,
  },
  onwarn,
  plugins: [
    url({
      include: ['models/**/*', '**/ffmpeg-worker.bundle.js'],
      limit: Infinity,
      emitFiles: false,
    }),
    typescript(),
    nodeResolve({ browser: true, preferBuiltins: false }),
    commonjs(),
    terser(),
  ],
}

const workerBundleConfig = {
  input: 'src/ffmpeg-worker-entry.js',
  output: {
    file: 'dist/ffmpeg-worker.bundle.js',
    format: 'esm', // using esm for a module worker
    sourcemap: false,
  },
  plugins: [
    alias({
      entries: [
        {
          // Force resolution of the internal worker file:
          find: '@ffmpeg/ffmpeg/dist/esm/worker.js',
          replacement: path.resolve(__dirname, 'node_modules/@ffmpeg/ffmpeg/dist/esm/worker.js'),
        },
      ],
    }),
    nodeResolve({ browser: true, preferBuiltins: false }),
    commonjs(),
    terser(),
  ],
};

// UMD Build for FFmpegWrapper.browser (for integration test)
const ffmpegWrapperBrowserConfig = {
  input: 'src/utils/FFmpegWrapper.browser.ts',
  output: {
    file: 'dist/utils/FFmpegWrapper.browser.umd.js',
    format: 'umd',
    name: 'FFmpegWrapper',
    sourcemap: true,
  },
  onwarn,
  plugins: [
    url({
      include: ['**/ffmpeg-worker.bundle.js'],
      limit: Infinity,
      emitFiles: false,
    }),
    typescript({
      tsconfig: './tsconfig.json',
      compilerOptions: {
        declaration: false,
        declarationMap: false,
        declarationDir: null,
      },
    }),
    json(),
    nodeResolve({ browser: true }),
    commonjs(),
    terser(),
  ],
}

export default [
  nodeEsmConfig,
  nodeCjsConfig,
  workerBundleConfig,
  browserConfig,
  ffmpegWrapperBrowserConfig
];
