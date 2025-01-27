module.exports = {
  projects: [
    {
      displayName: 'node',
      testEnvironment: 'node',
      testMatch: ['**/*.node.test.ts', '**/*.shared.test.ts'],
      transform: {
        '^.+\\.tsx?$': 'ts-jest',
      },
      setupFilesAfterEnv: ['./jest.setup.ts'],
    },
    {
      displayName: 'browser',
      testEnvironment: 'jest-environment-jsdom',
      testMatch: ['**/*.browser.test.ts', '**/*.shared.test.ts'],
      transform: {
        '^.+\\.tsx?$': 'ts-jest',
      },
      setupFilesAfterEnv: ['./jest.setup.ts'],
    },
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverage: true,
  moduleNameMapper: {
    '^@ffmpeg/ffmpeg$': '<rootDir>/node_modules/@ffmpeg/ffmpeg/dist/umd/ffmpeg.js',
  },
  testPathIgnorePatterns: [
    "/node_modules/",
    "<rootDir>/test/utils/FFmpegWrapperBrowserIntegration.test.js"
  ]
};
