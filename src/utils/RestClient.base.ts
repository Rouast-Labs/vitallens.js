import { REST_ENDPOINT } from "../config/constants";
import { IRestClient } from "../types/IRestClient";
import { float32ArrayToBase64, uint8ArrayToBase64 } from "./arrayOps";

/**
 * Utility class for managing REST communication.
 */
export abstract class RestClientBase implements IRestClient {
  protected url: string = REST_ENDPOINT;
  private apiKey: string;
  protected headers: Record<string, string>;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.headers = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
    };
  }

  /**
   * Abstract method for sending HTTP requests.
   * Implement this in environment-specific subclasses.
   * @param payload - The data to send in the request body.
   * @returns The server's response as a JSON-parsed object.
   */
  protected abstract postRequest(payload: Record<string, any>): Promise<any>;

  /**
   * Handles the HTTP response, throwing an error for non-OK status codes.
   * @param response - The Fetch API response object.
   * @returns The JSON-parsed response body.
   */
  protected async handleResponse(response: Response): Promise<any> {
    const bodyText = await response.text(); // Read the response body as text
  
    const structuredResponse = {
      statusCode: response.status,
      body: bodyText,
    };
      
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${bodyText}`);
    }
  
    try {
      structuredResponse.body = JSON.parse(bodyText); // Parse JSON if possible
    } catch (error) {
      // If parsing fails, leave `body` as raw text
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
  async sendFrames(metadata: Record<string, any>, frames: Uint8Array, state?: Float32Array): Promise<Response> {
    const base64Frames = uint8ArrayToBase64(frames);
    
    const payload: Record<string, any> = {
      video: base64Frames,
      ...metadata
    }

    if (state) {
      const base64State = float32ArrayToBase64(state);
      payload.state = base64State;
    }

    return this.postRequest(payload);
  }
}
