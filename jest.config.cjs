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
      },
      setupFilesAfterEnv: [
        './jest.setup.ts',
        '<rootDir>/src/polyfills/blob.cjs',
      ],
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
      },
      setupFilesAfterEnv: ['./jest.setup.ts'],
    },
    // Browser integration/E2E tests with Pippeteer
    {
      displayName: 'integration-browser',
      preset: 'jest-puppeteer',
      testMatch: ['**/*.puppeteer.test.ts'],
      transform: {
        '^.+\\.tsx?$': 'ts-jest',
      },
      setupFilesAfterEnv: ['./jest.setup.ts'],
    },
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverage: true,
  testPathIgnorePatterns: ['/node_modules/'],
};
