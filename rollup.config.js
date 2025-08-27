import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import url from '@rollup/plugin-url';
import terser from '@rollup/plugin-terser';
import json from '@rollup/plugin-json';
import alias from '@rollup/plugin-alias';
import replace from '@rollup/plugin-replace';
import { builtinModules } from 'module';
import { string } from 'rollup-plugin-string';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const bundleDir = path.resolve(__dirname, 'dist');

// Helper function to read a file and convert to a data URI
const toDataURI = (filePath, mimeType) => {
  const data = fs.readFileSync(filePath);
  return `data:${mimeType};base64,${data.toString('base64')}`;
};

function onwarn(warning, defaultHandler) {
  if (warning.code === 'THIS_IS_UNDEFINED') return;
  if (warning.code === 'CIRCULAR_DEPENDENCY') return;
  if (
    warning.code === 'UNRESOLVED_IMPORT' &&
    warning.source &&
    (warning.source.includes('ffmpeg-core-js') ||
      warning.source.includes('ffmpeg-core-wasm'))
  ) {
    return;
  }
  defaultHandler(warning);
}

const nodeExternals = ['@tensorflow/tfjs-node', ...builtinModules];

const ffmpegWorkerBundleConfig = {
  input: 'src/ffmpeg-worker-entry.js',
  output: {
    file: 'dist/ffmpeg.worker.bundle.js',
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

const faceDetectionWorkerNodeConfig = {
  input: 'src/ssd/faceDetection.worker.node.ts',
  external: nodeExternals,
  output: {
    file: 'dist/faceDetection.worker.node.bundle.js',
    format: 'cjs',
  },
  onwarn,
  plugins: [
    alias({
      entries: [
        {
          find: 'tfjs-provider',
          replacement: path.resolve(__dirname, 'src/tfjs-provider.node.ts'),
        },
      ],
    }),
    url({
      include: ['models/**/*'],
      limit: Infinity,
      emitFiles: false,
    }),
    typescript(),
    nodeResolve({
      browser: false,
      preferBuiltins: false,
    }),
    commonjs(),
    terser(),
  ],
};

const faceDetectionWorkerBrowserConfig = {
  input: 'src/ssd/faceDetection.worker.browser.ts',
  output: {
    file: 'dist/faceDetection.worker.browser.bundle.js',
    format: 'esm',
  },
  onwarn,
  plugins: [
    replace({
      preventAssignment: true,
      values: {
        // This flag tells FFmpegWrapper it's inside a worker
        IS_WORKER_CONTEXT: JSON.stringify(true),
        // These are not used in the worker but need to be defined
        SELF_CONTAINED_BUILD: JSON.stringify(false),
        __FFMPEG_CORE_URL__: JSON.stringify(''),
        __FFMPEG_WASM_URL__: JSON.stringify(''),
      },
    }),
    alias({
      entries: [
        {
          find: 'tfjs-provider',
          replacement: path.resolve(
            __dirname,
            'src/tfjs-provider.browser.worker.ts'
          ),
        },
      ],
    }),
    url({
      include: ['models/**/*', '**/ffmpeg.worker.bundle.js'],
      limit: Infinity,
      emitFiles: false,
    }),
    typescript(),
    nodeResolve({
      browser: true,
      preferBuiltins: false,
    }),
    commonjs(),
    terser(),
  ],
};

const nodeEsmConfig = {
  input: 'src/index.node.ts',
  external: nodeExternals,
  output: {
    file: 'dist/vitallens.esm.js',
    format: 'esm',
    inlineDynamicImports: true,
  },
  onwarn,
  plugins: [
    alias({
      entries: [
        {
          find: 'tfjs-provider',
          replacement: path.resolve(__dirname, 'src/tfjs-provider.node.ts'),
        },
      ],
    }),
    url({
      include: ['**/faceDetection.worker.node.bundle.js'],
      limit: Infinity,
      emitFiles: false,
    }),
    typescript(),
    json(),
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
    inlineDynamicImports: true,
  },
  onwarn,
  plugins: [
    alias({
      entries: [
        {
          find: 'tfjs-provider',
          replacement: path.resolve(__dirname, 'src/tfjs-provider.node.ts'),
        },
      ],
    }),
    url({
      include: ['**/faceDetection.worker.node.bundle.js'],
      limit: Infinity,
      emitFiles: false,
    }),
    typescript(),
    json(),
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
    inlineDynamicImports: true,
  },
  onwarn,
  plugins: [
    replace({
      preventAssignment: true,
      values: {
        SELF_CONTAINED_BUILD: JSON.stringify(false),
        IS_WORKER_CONTEXT: JSON.stringify(false),
        __FFMPEG_CORE_URL__: JSON.stringify(''),
        __FFMPEG_WASM_URL__: JSON.stringify(''),
      },
    }),
    alias({
      entries: [
        {
          find: 'tfjs-provider',
          replacement: path.resolve(__dirname, 'src/tfjs-provider.browser.ts'),
        },
      ],
    }),
    url({
      include: [
        '**/ffmpeg.worker.bundle.js',
        '**/faceDetection.worker.browser.bundle.js',
      ],
      limit: Infinity,
      emitFiles: false,
    }),
    url({
      include: ['**/*.svg'],
      limit: Infinity,
      emitFiles: true,
      fileName: '[dirname][hash][extname]',
    }),
    string({
      include: '**/web-components/*.html',
    }),
    typescript(),
    nodeResolve({
      browser: true,
      preferBuiltins: false,
    }),
    commonjs(),
    terser(),
  ],
};

const browserSelfContainedConfig = {
  input: 'src/index.browser.ts',
  output: {
    file: 'dist/vitallens.browser.selfcontained.js',
    format: 'esm',
    inlineDynamicImports: true,
  },
  onwarn,
  plugins: [
    replace({
      preventAssignment: true,
      values: {
        SELF_CONTAINED_BUILD: JSON.stringify(true),
        IS_WORKER_CONTEXT: JSON.stringify(false),
        __FFMPEG_CORE_URL__: JSON.stringify(
          toDataURI(
            path.resolve(
              __dirname,
              'node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js'
            ),
            'text/javascript'
          )
        ),
        __FFMPEG_WASM_URL__: JSON.stringify(
          toDataURI(
            path.resolve(
              __dirname,
              'node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm'
            ),
            'application/wasm'
          )
        ),
      },
    }),
    alias({
      entries: [
        {
          find: 'tfjs-provider',
          replacement: path.resolve(__dirname, 'src/tfjs-provider.browser.ts'),
        },
      ],
    }),
    url({
      include: [
        '**/ffmpeg.worker.bundle.js',
        '**/faceDetection.worker.browser.bundle.js',
        '**/*.svg',
      ],
      limit: Infinity,
      emitFiles: false,
    }),
    string({
      include: '**/web-components/*.html',
    }),
    typescript(),
    nodeResolve({
      browser: true,
      preferBuiltins: false,
    }),
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
  },
  onwarn,
  plugins: [
    url({
      include: ['**/ffmpeg.worker.bundle.js'],
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
  ? [
      ffmpegWorkerBundleConfig,
      faceDetectionWorkerNodeConfig,
      faceDetectionWorkerBrowserConfig,
      ffmpegWrapperBrowserConfig,
    ]
  : [
      ffmpegWorkerBundleConfig,
      faceDetectionWorkerNodeConfig,
      faceDetectionWorkerBrowserConfig,
      nodeEsmConfig,
      nodeCjsConfig,
      browserConfig,
      browserSelfContainedConfig,
    ];

export default config;
