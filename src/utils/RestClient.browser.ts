import { RestClientBase } from './RestClient.base';
import { VITALLENS_REST_ENDPOINT } from '../config/constants';
import { VitalLensAPIResponse } from '../types';

export class RestClient extends RestClientBase {
  /**
   * Get the REST endpoint.
   * @returns The REST endpoint.
   */
  protected getRestEndpoint(): string {
    return VITALLENS_REST_ENDPOINT;
  }

  /**
   * Sends an HTTP POST request using the browser's fetch API.
   * @param payload - The data to send in the request body.
   * @returns The server's response as a JSON-parsed object.
   */
  protected async postRequest(
    payload: Record<string, unknown>
  ): Promise<VitalLensAPIResponse> {
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
      });
      return this.handleResponse(response);
    } catch (error) {
      throw new Error(`POST request failed: ${error}`);
    }
  }
}
