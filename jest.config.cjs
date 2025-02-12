module.exports = {
  projects: [
    // Node tests
    {
      displayName: 'node',
      testEnvironment: 'node',
      testMatch: ['**/*.node.test.ts', '**/*.shared.test.ts'],
      transform: {
        '^.+\\.tsx?$': 'ts-jest',
      },
      moduleNameMapper: {
        'models/Ultra-Light-Fast-Generic-Face-Detector-1MB/model\\.json$':
          '<rootDir>/__mocks__/modelJsonMock.js',
        'models/Ultra-Light-Fast-Generic-Face-Detector-1MB/group1-shard1of1\\.bin$':
          '<rootDir>/__mocks__/modelBinMock.js',
        '^tfjs-provider$': '<rootDir>/src/tfjs-provider.node.ts',
      },
      setupFilesAfterEnv: ['./jest.setup.ts'],
    },
    // jsdom tests (lightweight browser-like unit tests)
    {
      displayName: 'browser',
      testEnvironment: 'jest-environment-jsdom',
      testMatch: ['**/*.browser.test.ts', '**/*.shared.test.ts'],
      transform: {
        '^.+\\.tsx?$': 'ts-jest',
      },
      moduleNameMapper: {
        '^@ffmpeg/ffmpeg$':
          '<rootDir>/node_modules/@ffmpeg/ffmpeg/dist/umd/ffmpeg.js',
        'models/Ultra-Light-Fast-Generic-Face-Detector-1MB/model\\.json$':
          '<rootDir>/__mocks__/modelJsonMock.js',
        'models/Ultra-Light-Fast-Generic-Face-Detector-1MB/group1-shard1of1\\.bin$':
          '<rootDir>/__mocks__/modelBinMock.js',
        '^tfjs-provider$': '<rootDir>/src/tfjs-provider.node.ts',
      },
      setupFilesAfterEnv: ['./jest.setup.ts'],
    },
    // Browser integration/E2E tests with Pippeteer
    {
      displayName: 'browser-integration',
      preset: 'jest-puppeteer',
      testMatch: ['**/*.browser.integration.test.ts'],
      transform: {
        '^.+\\.tsx?$': 'ts-jest',
      },
      setupFilesAfterEnv: ['./jest.setup.ts'],
    },
    // Node integration tests
    {
      displayName: 'node-integration',
      testEnvironment: 'node',
      testMatch: ['**/*.node.integration.test.ts'],
      transform: {
        '^.+\\.tsx?$': 'ts-jest',
      },
      moduleNameMapper: {
        'models/Ultra-Light-Fast-Generic-Face-Detector-1MB/model\\.json$':
          '<rootDir>/__mocks__/modelJsonMock.js',
        'models/Ultra-Light-Fast-Generic-Face-Detector-1MB/group1-shard1of1\\.bin$':
          '<rootDir>/__mocks__/modelBinMock.js',
        'dist/faceDetection\\.worker\\.node\\.bundle\\.js$':
          '<rootDir>/__mocks__/faceDetection.worker.node.bundle.js',
        '^tfjs-provider$': '<rootDir>/src/tfjs-provider.node.ts',
      },
      setupFilesAfterEnv: ['./jest.setup.ts'],
    },
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverage: true,
  testPathIgnorePatterns: ['/node_modules/'],
};
