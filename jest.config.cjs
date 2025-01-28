module.exports = {
  projects: [
    {
      displayName: 'node',
      testEnvironment: 'node',
      testMatch: ['**/*.node.test.ts', '**/*.shared.test.ts'],
      transform: {
        '^.+\\.tsx?$': 'ts-jest',
      },
      moduleNameMapper: {},
      setupFilesAfterEnv: ['./jest.setup.ts'],
    },
    {
      displayName: 'browser',
      testEnvironment: 'jest-environment-jsdom',
      testMatch: ['**/*.browser.test.ts', '**/*.shared.test.ts'],
      transform: {
        '^.+\\.tsx?$': 'ts-jest',
      },
      moduleNameMapper: {
        '^@ffmpeg/ffmpeg$': '<rootDir>/node_modules/@ffmpeg/ffmpeg/dist/umd/ffmpeg.js',
        'models/Ultra-Light-Fast-Generic-Face-Detector-1MB/model\\.json$':
          '<rootDir>/__mocks__/modelJsonMock.js',
        'models/Ultra-Light-Fast-Generic-Face-Detector-1MB/group1-shard1of1\\.bin$':
          '<rootDir>/__mocks__/modelBinMock.js',
      },
      setupFilesAfterEnv: ['./jest.setup.ts'],
    },
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverage: true,
  testPathIgnorePatterns: [
    "/node_modules/"
  ]
};
