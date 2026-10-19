import { describe, it, expect } from 'vitest';
import { DEFAULT_PERFORMANCE_MODE } from '../../src/config/constants';

describe('constants', () => {
  it('starts the UI components in standard mode', () => {
    expect(DEFAULT_PERFORMANCE_MODE).toBe('standard');
  });
});
