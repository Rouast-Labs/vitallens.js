import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';

export default [
  // ESM Build (Shared for Node.js + Browser)
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/vitallens.esm.js',
      format: 'esm',
      sourcemap: true,
    },
    plugins: [
      typescript(),
      nodeResolve(), // Resolves dependencies for Node.js and browser
      commonjs(), // Converts CommonJS modules to ES6
      terser(), // Minifies the output
    ],
  },
  // Browser Build (Browser-specific optimizations)
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/vitallens.browser.js',
      format: 'esm',
      sourcemap: true,
    },
    plugins: [
      typescript(),
      nodeResolve({ browser: true }), // Resolves browser-compatible dependencies
      commonjs(),
      terser(),
    ],
  },
];
