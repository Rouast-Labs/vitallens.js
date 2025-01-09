import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
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
      nodeResolve(),       // no browser: true, since it's for Node
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
      typescript(),
      nodeResolve({ browser: true }), // let it pick browser-friendly deps
      commonjs(),
      terser(),
    ],
  },
];
