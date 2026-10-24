// Copies the package.json version into src/utils/version.ts so the library can send it as part of the API origin.
// Runs from the npm "version" lifecycle (after `npm version` bumps package.json, before it commits).
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { version } = JSON.parse(
  fs.readFileSync(path.join(root, 'package.json'), 'utf-8')
);
const file = path.join(root, 'src/utils/version.ts');
const source = fs.readFileSync(file, 'utf-8');
const pattern = /export const VERSION = '[^']*';/;

if (!pattern.test(source)) {
  console.error(`Could not find the VERSION constant in ${file}`);
  process.exit(1);
}

fs.writeFileSync(
  file,
  source.replace(pattern, `export const VERSION = '${version}';`)
);
console.log(`Set VERSION to ${version} in src/utils/version.ts`);
