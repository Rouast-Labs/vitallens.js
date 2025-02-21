import {
  VitalLensAPIError,
  VitalLensAPIKeyError,
  VitalLensAPIQuotaExceededError,
} from '../../src/utils/errors';

describe('VitalLensAPIError classes', () => {
  describe('VitalLensAPIError', () => {
    it('should create an error with the correct name and message', () => {
      const error = new VitalLensAPIError('An error occurred');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(VitalLensAPIError);
      expect(error.name).toBe('VitalLensAPIError');
      expect(error.message).toBe('An error occurred');
    });
  });

  describe('VitalLensAPIKeyError', () => {
    it('should create an error with the correct name and default message', () => {
      const error = new VitalLensAPIKeyError();
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(VitalLensAPIKeyError);
      expect(error.name).toBe('VitalLensAPIKeyError');
      expect(error.message).toMatch(/A valid API key is required/);
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
  });
});
