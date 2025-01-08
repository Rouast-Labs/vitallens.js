import { MethodHandler } from './MethodHandler';
import { Frame, VitalLensOptions, VitalLensResult } from '../types/core';
import { WebSocketClient } from '../utils/WebSocketClient';

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
   * Sends a buffer of frames to the VitalLens API via WebSocket and processes the response.
   * @param frames - Array of frames to send.
   * @param state - Optional recurrent state from the previous API call.
   * @returns A promise that resolves to the processed result.
   */
  async process(frames: Frame[], state?: any): Promise<VitalLensResult> {
    const payload = {
      frames: frames.map((frame) => frame.data).join(','), // Concatenate frame data as base64 string
      state,
    };

    try {
      const response = await this.webSocketClient.send(payload);
      return {
        vitals: response.vitals,
        state: response.state,
      };
    } catch (error) {
      throw new Error(`VitalLens API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
