import { VitalLensAPIResponse, VitalLensResult } from '../types';
import { IRestClient } from '../types/IRestClient';
import { float32ArrayToBase64, uint8ArrayToBase64 } from './arrayOps';

/**
 * Utility class for managing REST communication.
 */
export abstract class RestClientBase implements IRestClient {
  protected url: string;
  private apiKey: string;
  protected headers: Record<string, string>;

  constructor(apiKey: string, proxyUrl?: string) {
    this.url = proxyUrl ?? this.getRestEndpoint();
    this.apiKey = apiKey;
    this.headers = {
      'Content-Type': 'application/json',
      ...(proxyUrl ? {} : { 'x-api-key': this.apiKey }),
    };
  }

  /**
   * Abstract method to get the REST endpoint.
   * @returns The REST endpoint.
   */
  protected abstract getRestEndpoint(): string;

  /**
   * Abstract method for sending HTTP requests.
   * Implement this in environment-specific subclasses.
   * @param payload - The data to send in the request body.
   * @returns The server's response as a JSON-parsed object.
   */
  protected abstract postRequest(
    payload: Record<string, unknown>
  ): Promise<VitalLensAPIResponse>;

  /**
   * Handles the HTTP response, throwing an error for non-OK status codes.
   * @param response - The Fetch API response object.
   * @returns The JSON-parsed response body.
   */
  protected async handleResponse(
    response: Response
  ): Promise<VitalLensAPIResponse> {
    const bodyText = await response.text(); // Read the response body as text

    const structuredResponse: VitalLensAPIResponse = {
      statusCode: response.status,
      body: {} as VitalLensResult,
    };

    try {
      // Parse the text and cast it to VitalLensResult
      structuredResponse.body = JSON.parse(bodyText) as VitalLensResult;
    } catch (error) {
      console.error('Error parsing JSON:', error);
    }

    return structuredResponse;
  }

  /**
   * Sends frames to the VitalLens API for estimation.
   * @param metadata - The metadata object to include in the final chunk.
   * @param frames - The raw frame data as a Uint8Array.
   * @param state - The state data as a Float32Array (optional).
   * @returns The server's response as a JSON-parsed object.
   */
  async sendFrames(
    metadata: Record<string, unknown>,
    frames: Uint8Array,
    state?: Float32Array
  ): Promise<VitalLensAPIResponse> {
    const base64Frames = uint8ArrayToBase64(frames);

    const payload: Record<string, unknown> = {
      video: base64Frames,
      ...metadata,
    };

    if (state) {
      const base64State = float32ArrayToBase64(state);
      payload.state = base64State;
    }

    return this.postRequest(payload);
  }
}
