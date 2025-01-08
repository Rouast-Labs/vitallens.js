/**
 * Utility to determine the runtime environment.
 * @returns `true` if running in a browser, `false` if running in Node.js.
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.document !== 'undefined';
}
