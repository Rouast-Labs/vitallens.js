import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import fs from 'fs';

const isIntegration = process.env.RUN_INTEGRATION === 'true';

export default defineConfig({
  plugins: [
    {
      name: 'bundle-as-data-uri',
      enforce: 'pre',
      load(id) {
        if (id.includes('.bundle.js')) {
          const content = fs.readFileSync(id.split('?')[0]);
          const base64 = content.toString('base64');
          return `export default "data:application/javascript;base64,${base64}";`;
        }
        // Tell Vitest to just return the absolute path to the model files
        if (id.includes('models/') && (id.endsWith('.json') || id.endsWith('.bin'))) {
          return `export default ${JSON.stringify(id.split('?')[0])};`;
        }
      }
    }
  ],
  resolve: {
    alias: {
      'vitallens-core/vitallens_core_bg.wasm': resolve(
        __dirname,
        '__mocks__/wasmMock.js'
      ),
      'tfjs-provider': resolve(__dirname, 'src/tfjs-provider.node.ts'),
      ...(isIntegration ? {} : {
        '@ffmpeg/ffmpeg': resolve(__dirname, '__mocks__/ffmpegMock.js'),
      }),
    },
  },
  test: {
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    exclude: isIntegration 
      ? ['**/node_modules/**', '**/dist/**'] 
      : ['**/node_modules/**', '**/dist/**', '**/*.integration.test.ts'],
    environmentMatchGlobs: [
      ['test/**/*.browser.test.ts', 'jsdom'],
      ['test/**/*.browser.integration.test.ts', 'jsdom'],
      ['test/**/*.node.test.ts', 'node'],
      ['test/**/*.node.integration.test.ts', 'node'],
      ['test/**/*.shared.test.ts', 'jsdom'],
    ],
  },
});