import {
  VitalLensAPIError,
  VitalLensAPIKeyError,
  VitalLensAPIQuotaExceededError,
} from '../../src/utils/errors';
import { describe, expect, it } from 'vitest';

describe('VitalLensAPIError classes', () => {
  describe('VitalLensAPIError', () => {
    it('should create an error with the correct name and message', () => {
      const error = new VitalLensAPIError('An error occurred');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(VitalLensAPIError);
      expect(error.name).toBe('VitalLensAPIError');
      expect(error.message).toBe('An error occurred');
    });

    it('should correctly store the cause if provided', () => {
      const originalError = new Error('Network failure');
      const error = new VitalLensAPIError('An error occurred', {
        cause: originalError,
      });
      expect(error.cause).toBe(originalError);
    });
  });

  describe('VitalLensAPIKeyError', () => {
    it('should create an error with the correct name and default message', () => {
      const error = new VitalLensAPIKeyError();
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(VitalLensAPIKeyError);
      expect(error.name).toBe('VitalLensAPIKeyError');
      expect(error.message).toMatch(/A valid API key or proxy URL is required/);
    });

    it('should correctly store the cause if provided', () => {
      const originalError = new Error('403 Forbidden');
      const error = new VitalLensAPIKeyError('Custom message', {
        cause: originalError,
      });
      expect(error.cause).toBe(originalError);
    });
  });

  describe('VitalLensAPIQuotaExceededError', () => {
    it('should create an error with the correct name and default message', () => {
      const error = new VitalLensAPIQuotaExceededError();
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(VitalLensAPIQuotaExceededError);
      expect(error.name).toBe('VitalLensAPIQuotaExceededError');
      expect(error.message).toMatch(
        /The quota or rate limit associated with your API key may have been exceeded/
      );
    });

    it('should correctly store the cause if provided', () => {
      const originalError = new Error('Rate limit hit');
      const error = new VitalLensAPIQuotaExceededError(undefined, {
        cause: originalError,
      });
      expect(error.cause).toBe(originalError);
    });
  });
});
