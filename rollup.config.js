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
import { builtinModules } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const bundleDir = path.resolve(__dirname, 'dist');

function onwarn(warning, defaultHandler) {
  if (warning.code === 'THIS_IS_UNDEFINED') return;
  if (warning.code === 'CIRCULAR_DEPENDENCY') return;
  defaultHandler(warning);
}

// TODO: Check if any options have become are superfluous

const nodeExternals = [
  '@tensorflow/tfjs',
  '@tensorflow/tfjs-node',
  ...builtinModules,
];

const ffmpegWorkerBundleConfig = {
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

const faceDetectionWorkerNodeConfig = {
  input: 'src/ssd/faceDetection.worker.node.ts',
  external: nodeExternals,
  output: {
    file: 'dist/faceDetection.worker.node.bundle.js',
    format: 'cjs',
  },
  plugins: [
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
  external: ['@tensorflow/tfjs'],
  output: {
    file: 'dist/faceDetection.worker.browser.bundle.js',
    format: 'esm',
  },
  plugins: [
    url({
      include: ['models/**/*', '**/ffmpeg-worker.bundle.js'],
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
    url({
      include: [
        '**/ffmpeg-worker.bundle.js',
        '**/faceDetection.worker.browser.bundle.js',
      ],
      limit: Infinity,
      emitFiles: false,
    }),
    typescript(),
    nodeResolve({
      browser: true,
      preferBuiltins: false,
      dedupe: ['@tensorflow/tfjs'],
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
    ];

export default config;
