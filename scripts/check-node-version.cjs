/* eslint-disable @typescript-eslint/no-require-imports */
const semver = require('semver');

const currentVersion = process.version;
const platform = process.platform;

// For Windows: Warn but allow newer versions
if (platform === 'win32') {
  // Use loose check: if it's NOT 18.x, just warn.
  if (!currentVersion.startsWith('v18.')) {
    console.warn(
      `\x1b[33m%s\x1b[0m`, // Yellow text
      `WARNING: You are using Node ${currentVersion} on Windows.\n` +
        `VitalLens recommends Node 18.x for Windows to ensure the AI engine installs correctly.\n` +
        `If installation fails, the 'vitallens' package will still be installed, but server-side inference might not work.\n`
    );
  }
} else {
  // For macOS and Linux: require Node 18.x or Node 20.x
  if (!semver.satisfies(currentVersion, '>=18.0.0')) {
    console.error(
      `Error: This project requires Node 18 or above on non-Windows platforms. Detected version: ${currentVersion}.`
    );
    process.exit(1);
  }
}
