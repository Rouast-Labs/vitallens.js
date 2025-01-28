import { 
  VitalLensAPIError,
  VitalLensAPIKeyError,
  VitalLensAPIQuotaExceededError
} from "../../src/utils/errors";

describe("VitalLensAPIError classes", () => {
  describe("VitalLensAPIError", () => {
    it("should create an error with the correct name and message", () => {
      const error = new VitalLensAPIError("An error occurred");
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(VitalLensAPIError);
      expect(error.name).toBe("VitalLensAPIError");
      expect(error.message).toBe("An error occurred");
    });
  });

  describe("VitalLensAPIKeyError", () => {
    it("should create an error with the correct name and default message", () => {
      const error = new VitalLensAPIKeyError();
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(VitalLensAPIError);
      expect(error).toBeInstanceOf(VitalLensAPIKeyError);
      expect(error.name).toBe("VitalLensAPIKeyError");
      expect(error.message).toBe("Invalid API Key");
    });
  });

  describe("VitalLensAPIQuotaExceededError", () => {
    it("should create an error with the correct name and default message", () => {
      const error = new VitalLensAPIQuotaExceededError();
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(VitalLensAPIError);
      expect(error).toBeInstanceOf(VitalLensAPIQuotaExceededError);
      expect(error.name).toBe("VitalLensAPIQuotaExceededError");
      expect(error.message).toBe("API quota exceeded");
    });
  });
});
