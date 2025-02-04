import { fileURLToPath } from 'url';
import path from 'path';
import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import url from '@rollup/plugin-url';
import { terser } from 'rollup-plugin-terser';
import json from '@rollup/plugin-json';
import alias from '@rollup/plugin-alias';
import replace from '@rollup/plugin-replace';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const bundleDir = path.resolve(__dirname, 'dist');

function onwarn(warning, defaultHandler) {
  if (warning.code === 'THIS_IS_UNDEFINED') return;
  if (warning.code === 'CIRCULAR_DEPENDENCY') return;
  defaultHandler(warning);
}

const nodeExternals = ['@tensorflow/tfjs-node'];

const nodeEsmConfig = {
  input: 'src/index.node.ts',
  external: nodeExternals,
  output: {
    file: 'dist/vitallens.esm.js',
    format: 'esm',
    sourcemap: true,
    inlineDynamicImports: true,
  },
  onwarn,
  plugins: [
    url({
      include: ['models/**/*'],
      limit: Infinity,
      emitFiles: false,
    }),
    typescript(),
    json({
      exclude: ['models/**/*'],
    }),
    nodeResolve({ browser: false, preferBuiltins: true }),
    commonjs({ transformMixedEsModules: true, requireReturnsDefault: 'auto' }),
    replace({
      __dirname: JSON.stringify(bundleDir),
      preventAssignment: true,
    }),
    terser(),
  ],
};

const nodeCjsConfig = {
  input: 'src/index.node.ts',
  external: nodeExternals,
  output: {
    file: 'dist/vitallens.cjs.js',
    format: 'cjs',
    sourcemap: true,
    inlineDynamicImports: true,
  },
  onwarn,
  plugins: [
    url({
      include: ['models/**/*'],
      limit: Infinity,
      emitFiles: false,
    }),
    typescript(),
    json({
      exclude: ['models/**/*'],
    }),
    nodeResolve({ browser: false, preferBuiltins: true }),
    commonjs(),
    terser(),
  ],
};

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
};

const workerBundleConfig = {
  input: 'src/ffmpeg-worker-entry.js',
  output: {
    file: 'dist/ffmpeg-worker.bundle.js',
    format: 'esm',
    sourcemap: false,
  },
  plugins: [
    alias({
      entries: [
        {
          find: '@ffmpeg/ffmpeg/dist/esm/worker.js',
          replacement: path.resolve(
            __dirname,
            'node_modules/@ffmpeg/ffmpeg/dist/esm/worker.js'
          ),
        },
      ],
    }),
    nodeResolve({ browser: true, preferBuiltins: false }),
    commonjs(),
    terser(),
  ],
};

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
        declarationDir: undefined,
      },
    }),
    json(),
    nodeResolve({ browser: true }),
    commonjs(),
    terser(),
  ],
};

const config = process.env.BUILD_INTEGRATION
  ? [workerBundleConfig, ffmpegWrapperBrowserConfig]
  : [nodeEsmConfig, nodeCjsConfig, workerBundleConfig, browserConfig];

export default config;
