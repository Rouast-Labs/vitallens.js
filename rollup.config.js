import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import url from '@rollup/plugin-url';
import { terser } from 'rollup-plugin-terser';

export default [
  // Node ESM build
  {
    input: 'src/index.node.ts',
    output: {
      file: 'dist/vitallens.esm.js',
      format: 'esm',
      sourcemap: true,
      inlineDynamicImports: true,
    },
    plugins: [
      typescript(),
      nodeResolve(),
      commonjs(),
      terser(),
    ],
  },
  // Node CJS build
  {
    input: 'src/index.node.ts',
    output: {
      file: 'dist/vitallens.cjs.js',
      format: 'cjs',
      sourcemap: true,
      inlineDynamicImports: true,
    },
    plugins: [
      typescript(),
      nodeResolve(),
      commonjs(),
      terser(),
    ],
  },
  // Browser ESM build
  {
    input: 'src/index.browser.ts',
    output: {
      file: 'dist/vitallens.browser.js',
      format: 'esm',
      sourcemap: true,
      inlineDynamicImports: true,
    },
    plugins: [
      url({
        include: ['models/**/*'],
        limit: Infinity,
        emitFiles: false,
      }),
      typescript(),
      nodeResolve({ browser: true, preferBuiltins: false }),
      commonjs(),
      terser(),
    ],
  },
  // UMD Build for FFmpegWrapper.browser (for integration test)
  {
    input: 'src/utils/FFmpegWrapper.browser.ts',
    output: {
      file: 'dist/utils/FFmpegWrapper.browser.umd.js',
      format: 'umd',
      name: 'FFmpegWrapper',
      sourcemap: true,
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        compilerOptions: {
          declaration: false,
          declarationMap: false,
          declarationDir: null,
        },
      }),
      nodeResolve({ browser: true }),
      commonjs(),
      terser(),
    ],
  },
];
