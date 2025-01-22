export class VitalLensAPIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VitalLensAPIError';
  }
}

export class VitalLensAPIKeyError extends VitalLensAPIError {
  constructor() {
    super('Invalid API Key');
    this.name = 'VitalLensAPIKeyError';
  }
}

export class VitalLensAPIQuotaExceededError extends VitalLensAPIError {
  constructor() {
    super('API quota exceeded');
    this.name = 'VitalLensAPIQuotaExceededError';
  }
}
