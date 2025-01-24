import { VitalLensResult } from "../types";
import { uint8ArrayToBase64 } from "./frameOps";

/**
 * Utility class for managing REST communication.
 */
export class RestClient {
  private url: string;
  private apiKey: string;
  private headers: Record<string, string>;

  constructor(url: string, apiKey: string) {
    this.url = url;
    this.apiKey = apiKey;
    this.headers = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
    };
  }

  /**
   * Send a JSON payload.
   * @param payload - The data to send in the request body.
   * @returns The server's response as a JSON-parsed object.
   */
  private async post(payload: Record<string, any>): Promise<any> {
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

  /**
   * Handles the HTTP response, throwing an error for non-OK status codes.
   * @param response - The Fetch API response object.
   * @returns The JSON-parsed response body.
   */
  private async handleResponse(response: Response): Promise<any> {
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
  async sendFrames(metadata: Record<string, any>, frames: Uint8Array, state?: Float32Array): Promise<VitalLensResult> {
    // TODO: Make sure less than 900 frames
    
    const base64Frames = uint8ArrayToBase64(frames);
    const base64State = state ? btoa(String.fromCharCode(...new Uint8Array(state.buffer))) : null;

    const payload: Record<string, any> = {
      video: base64Frames,
      ...metadata
    }

    if (base64State) {
      payload.state = base64State;
    }

    return this.post(payload);
  }
}
