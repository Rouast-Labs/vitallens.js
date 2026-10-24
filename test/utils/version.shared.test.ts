import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { VERSION, getApiOrigin } from '../../src/utils/version';

describe('version', () => {
  it('matches package.json', () => {
    const pkg = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf-8')
    );
    expect(VERSION).toBe(pkg.version);
  });

  it('getApiOrigin appends the version to the client name', () => {
    expect(getApiOrigin()).toBe(`vitallens.js_${VERSION}`);
    expect(getApiOrigin('vitallens.js')).toBe(`vitallens.js_${VERSION}`);
  });

  it('getApiOrigin sends test as is', () => {
    expect(getApiOrigin('test')).toBe('test');
  });
});
