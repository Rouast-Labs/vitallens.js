/**
 * The package version. Must match `version` in package.json (checked by a test); bump both together when releasing.
 */
export const VERSION = '0.4.9';

/**
 * The origin label sent to the API: `vitallens.js_<version>`, so usage can be broken down by client version.
 * The `test` origin is sent as is because the API treats it specially.
 */
export const getApiOrigin = (origin?: 'vitallens.js' | 'test'): string =>
  origin === 'test' ? 'test' : `vitallens.js_${VERSION}`;
