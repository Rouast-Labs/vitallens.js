export class VitalLensAPIError extends Error {
  constructor(message = 'Bad request or an error occurred in the API.') {
    super(message);
    this.name = 'VitalLensAPIError';
  }
}

export class VitalLensAPIKeyError extends Error {
  constructor(
    message = 'A valid API key or proxy URL is required to use method=vitallens. Get one for free at https://www.rouast.com/api.'
  ) {
    super(message);
    this.name = 'VitalLensAPIKeyError';
  }
}

export class VitalLensAPIQuotaExceededError extends Error {
  constructor(
    message = 'The quota or rate limit associated with your API key may have been exceeded. Check your account at https://www.rouast.com/api and consider changing to a different plan.'
  ) {
    super(message);
    this.name = 'VitalLensAPIQuotaExceededError';
  }
}
