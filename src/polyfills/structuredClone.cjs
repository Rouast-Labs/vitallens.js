/* eslint-disable no-undef */
if (typeof structuredClone !== 'function') {
  globalThis.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}
