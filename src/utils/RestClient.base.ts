import { InferenceMode, VitalLensAPIResponse, VitalLensResult } from '../types';
import { IRestClient, ResolveModelResponse } from '../types/IRestClient';
import { float32ArrayToBase64, uint8ArrayToBase64 } from './arrayOps';

/**
 * Utility class for managing REST communication.
 */
export abstract class RestClientBase implements IRestClient {
  protected proxyUrl: string | null = null;
  protected apiKey: string;

  constructor(apiKey: string, proxyUrl?: string) {
    this.proxyUrl = proxyUrl ?? null;
    this.apiKey = apiKey;
  }

  /**
   * Abstract method to get the REST endpoint.
   * @param mode - The inference mode.
   * @returns The REST endpoint.
   */
  protected abstract getRestEndpoint(mode: InferenceMode): string;

  /**
   * Abstract method to resolve the model.
   * @param requestedModel - The requested model (optional)
   */
  abstract resolveModel(requestedModel?: string): Promise<ResolveModelResponse>;

  /**
   * Abstract method for sending HTTP requests.
   * @param headers - The headers.
   * @param body - The body.
   * @param mode - The inference mode ('file' or 'stream').
   * @returns The server's response as a JSON-parsed object.
   */
  protected abstract postRequest(
    headers: Record<string, string>,
    body: Record<string, unknown> | Uint8Array,
    mode: InferenceMode
  ): Promise<VitalLensAPIResponse>;

  /**
   * Abstract method for compressing a Uint8Array.
   * @param data - The binary data to compress.
   * @returns A Promise that resolves with the compressed data as a Uint8Array.
   */
  protected abstract compress(data: Uint8Array): Promise<Uint8Array>;

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
   * @param metadata - The metadata object.
   * @param frames - The raw frame data as a Uint8Array.
   * @param mode - The inference mode ('file' or 'stream').
   * @param state - The state data as a Float32Array (optional).
   * @returns The server's response as a JSON-parsed object.
   */
  async sendFrames(
    metadata: Record<string, unknown>,
    frames: Uint8Array,
    mode: InferenceMode,
    state?: Float32Array
  ): Promise<VitalLensAPIResponse> {
    if (mode === 'stream') {
      // Stream mode: binary (application/octet-stream)
      // Put metadata and state in the headers.
      const customHeaders: Record<string, string> = {};

      Object.entries(metadata).forEach(([key, value]) => {
        customHeaders[`X-${key.charAt(0).toUpperCase() + key.slice(1)}`] =
          String(value);
      });

      if (state) {
        customHeaders['X-State'] = float32ArrayToBase64(state);
      }

      const compressedFrames = await this.compress(frames);

      // Capture the start time
      const response = await this.postRequest(
        customHeaders,
        compressedFrames,
        mode
      );
      return response;
    } else {
      // File mode: JSON (base64 encoding)
      const base64Frames = uint8ArrayToBase64(frames);
      const payload: Record<string, unknown> = {
        video: base64Frames,
        ...metadata,
      };

      if (state) {
        payload.state = float32ArrayToBase64(state);
      }

      return this.postRequest({}, payload, mode);
    }
  }
}
