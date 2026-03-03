import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@ffmpeg/ffmpeg': resolve(__dirname, '__mocks__/ffmpegMock.js'),
      'vitallens-core/vitallens_core_bg.wasm': resolve(__dirname, '__mocks__/wasmMock.js'),
      '../../models/Ultra-Light-Fast-Generic-Face-Detector-1MB/model.json': resolve(__dirname, '__mocks__/modelJsonMock.js'),
      '../../models/Ultra-Light-Fast-Generic-Face-Detector-1MB/group1-shard1of1.bin': resolve(__dirname, '__mocks__/modelBinMock.js'),
      'tfjs-provider': resolve(__dirname, 'src/tfjs-provider.node.ts'),
    }
  },
  test: {
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    environmentMatchGlobs: [
      ['test/**/*.browser.test.ts', 'jsdom'],
      ['test/**/*.node.test.ts', 'node'],
      ['test/**/*.shared.test.ts', 'jsdom'], 
      ['test/**/*.integration.test.ts', 'node']
    ],
  }
});