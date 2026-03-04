import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@ffmpeg/ffmpeg': resolve(__dirname, '__mocks__/ffmpegMock.js'),
      'vitallens-core/vitallens_core_bg.wasm': resolve(
        __dirname,
        '__mocks__/wasmMock.js'
      ),
      'tfjs-provider': resolve(__dirname, 'src/tfjs-provider.node.ts'),
    },
  },
  test: {
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.integration.test.ts'],
    environmentMatchGlobs: [
      ['test/**/*.browser.test.ts', 'jsdom'],
      ['test/**/*.node.test.ts', 'node'],
      ['test/**/*.shared.test.ts', 'jsdom'],
    ],
  },
});
