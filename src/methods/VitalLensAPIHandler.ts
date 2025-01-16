import { MethodHandler } from './MethodHandler';
import { VitalLensOptions, VitalLensResult } from '../types/core';
import { WebSocketClient } from '../utils/WebSocketClient';
import { Frame } from '../processing/Frame';

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
   * @param framesChunk - Frame chunk to send.
   * @param state - Optional recurrent state from the previous API call.
   * @returns A promise that resolves to the processed result.
   */
  async process(framesChunk: Frame, state?: any): Promise<VitalLensResult> {
    framesChunk.retain();
    // TODO: Generate base64 string
    const payload = {
      frames: frames.map((frame) => frame.data).join(','), // Concatenate frame data as base64 string
      state,
    };
    framesChunk.release();   
    try {
      const response = await this.webSocketClient.send(payload);
      // TODO: Parse response and integrate properly with VitalLensResult
      return {
        vitals: response.vitals,
        state: response.state,
        time: framesChunk.timestamp,
      };
    } catch (error) {
      throw new Error(`VitalLens API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
