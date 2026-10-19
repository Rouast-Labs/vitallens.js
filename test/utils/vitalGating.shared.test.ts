import { describe, it, expect } from 'vitest';
import { isHrvShown } from '../../src/utils/vitalGating';

describe('isHrvShown', () => {
  it('shows HRV when both HRV and HR are confident', () => {
    expect(isHrvShown(0.85, 0.9, 0.8, 0.8)).toBe(true);
  });

  it('hides HRV when HR is not confident, even if HRV is', () => {
    expect(isHrvShown(0.95, 0.79, 0.8, 0.8)).toBe(false);
  });

  it('hides HRV when HRV itself is not confident', () => {
    expect(isHrvShown(0.79, 0.95, 0.8, 0.8)).toBe(false);
  });

  it('treats the threshold as inclusive', () => {
    expect(isHrvShown(0.8, 0.8, 0.8, 0.8)).toBe(true);
  });

  it('hides HRV when confidences are missing', () => {
    expect(isHrvShown(undefined, 0.9, 0.8, 0.8)).toBe(false);
    expect(isHrvShown(0.9, undefined, 0.8, 0.8)).toBe(false);
  });
});
