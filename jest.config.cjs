module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node', // or 'jsdom' if you test browser behavior
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@ffmpeg/ffmpeg$': '<rootDir>/node_modules/@ffmpeg/ffmpeg/dist/umd/ffmpeg.js',
  },
};
