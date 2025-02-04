/* eslint-disable @typescript-eslint/no-require-imports */
const semver = require('semver');

const currentVersion = process.version; // e.g. "v18.16.1"
const platform = process.platform; // "win32", "darwin", "linux", etc.

// For Windows: require exactly Node 18.16.1
if (platform === 'win32') {
  if (currentVersion !== 'v18.16.1') {
    console.error(
      `Error: On Windows, this project requires Node 18.16.1. Detected version: ${currentVersion}.`
    );
    process.exit(1);
  }
} else {
  // For macOS and Linux: require Node 18.x or Node 20.x (or greater, as per your policy)
  // Adjust the semver range as needed. Here, we assume ">=18.0.0" is acceptable.
  if (!semver.satisfies(currentVersion, '>=18.0.0')) {
    console.error(
      `Error: This project requires Node 18 or above on non-Windows platforms. Detected version: ${currentVersion}.`
    );
    process.exit(1);
  }
}
