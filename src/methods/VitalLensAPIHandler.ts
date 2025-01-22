import { MethodHandler } from './MethodHandler';
import { VitalLensOptions, VitalLensResult } from '../types/core';
import { WebSocketClient } from '../utils/WebSocketClient';
import { Frame } from '../processing/Frame';
import { VitalLensAPIError, VitalLensAPIKeyError, VitalLensAPIQuotaExceededError } from '../utils/errors';

/**
 * Handler for processing frames using the VitalLens API via WebSocket.
 */
export class VitalLensAPIHandler extends MethodHandler {
  private webSocketClient: WebSocketClient;

  constructor(webSocketClient: WebSocketClient, options: VitalLensOptions) {
    super(options);
    this.webSocketClient = webSocketClient;
  }

  /**
   * Initialise the method.
   */
  async init(): Promise<void> {
    this.webSocketClient.connect();
  }

  /**
   * Cleanup the method.
   */
  async cleanup(): Promise<void> {
    this.webSocketClient.close();
  }

  /**
   * Get readiness state.
   * @returns Whether the method is ready for prediction.
   */
  getReady(): boolean {
    // Ready if WebSocket is connected.
    return this.webSocketClient.getIsConnected();
  }

  /**
   * Get the method name. Subclasses must implement this.
   * @returns The method name.
   */
  protected getMethodName(): string {
    return "VitalLens API"
  }

  /**
   * Sends a buffer of frames to the VitalLens API via WebSocket and processes the response.
   * @param framesChunk - Frame chunk to send, already in shape (n_frames, 40, 40, 3).
   * @param state - Optional recurrent state from the previous API call.
   * @returns A promise that resolves to the processed result.
   */
  async process(framesChunk: Frame, state?: any): Promise<VitalLensResult | undefined> {
    if (!this.webSocketClient.getIsConnected()) {
      return undefined;
    }
    
    try {
      // Store the roi.
      const roi = framesChunk.getROI();
      const videoBase64 = framesChunk.getBase64Data();
      // Prepare the payload.
      const payload = {
        action: 'sendFrames',
        version: 'vitallens-dev',
        frames: videoBase64,
        origin: 'vitallens.js',
        ...(state && { state: JSON.stringify(state) }),
      };
      // Send the payload via WebSocket.
      // TODO: Most of the time socket just closes - Why?
      console.log("About to send payload:", payload);
      console.log("payload.frame:", payload.frames);
      const response = await this.webSocketClient.send(payload);
      // Parse the WebSocket response.
      if (!response || typeof response.statusCode !== 'number') {
        throw new VitalLensAPIError('Invalid response format');
      }
      // Handle errors based on status code
      if (response.statusCode !== 200) {
        const message = response.body ? JSON.parse(response.body).message : 'Unknown error';
        if (response.statusCode === 403) {
          throw new VitalLensAPIKeyError();
        } else if (response.statusCode === 429) {
          throw new VitalLensAPIQuotaExceededError();
        } else if (response.statusCode === 400) {
          throw new VitalLensAPIError(`Parameters missing: ${message}`);
        } else if (response.statusCode === 422) {
          throw new VitalLensAPIError(`Issue with provided parameters: ${message}`);
        } else if (response.statusCode === 500) {
          throw new VitalLensAPIError(`Error occurred in the API: ${message}`);
        } else {
          throw new VitalLensAPIError(`Error ${response.statusCode}: ${message}`);
        }
      }

      // Parse the successful response
      const parsedResponse = JSON.parse(response.body);
      const vitalSigns = parsedResponse.vital_signs || {};
      const face = parsedResponse.face || {};
      const newState = parsedResponse.state || [];
      const message = parsedResponse.message || 'No message';

      // Log the parsed response.
      console.log("Parsed response:", { vitalSigns, newState, state, face, message });

      return {
        face: {
          coordinates: roi.map(roi => [roi.x, roi.y, roi.width, roi.height]),
          confidence: face.confidence,
          note: "Face detection coordinates for this face, along with live confidence levels."
        },
        vital_signs: vitalSigns,
        state: newState,
        time: framesChunk.getTimestamp(),
        message: "The provided values are estimates and should be interpreted according to the provided confidence levels ranging from 0 to 1. The VitalLens API is not a medical device and its estimates are not intended for any medical purposes."
      };
    } catch (error) {
      throw new Error(`VitalLens API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
