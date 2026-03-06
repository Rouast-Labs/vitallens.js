export class VitalLensAPIError extends Error {
  constructor(
    message = 'Bad request or an error occurred in the API.',
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = 'VitalLensAPIError';
  }
}

export class VitalLensAPIKeyError extends Error {
  constructor(
    message = 'A valid API key or proxy URL is required to use VitalLens. If you signed up recently, please try again in a minute to allow your API key to become active. Otherwise, head to https://www.rouast.com/api to get a free API key.',
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = 'VitalLensAPIKeyError';
  }
}

export class VitalLensAPIQuotaExceededError extends Error {
  constructor(
    message = 'The quota or rate limit associated with your API key may have been exceeded. Check your account at https://www.rouast.com/api and consider changing to a different plan.',
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = 'VitalLensAPIQuotaExceededError';
  }
}
