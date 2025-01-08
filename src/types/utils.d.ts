/**
 * Type definitions for utility modules in the VitalLens library.
 */

/**
 * Represents a utility for handling frames, such as cropping or resizing.
 */
export interface FrameUtility {
  /**
   * Crops and resizes a frame.
   * @param imageData - Base64 string or Buffer of the image data.
   * @param roi - Region of interest to crop.
   * @param targetWidth - Desired width of the output image.
   * @param targetHeight - Desired height of the output image.
   * @returns A promise resolving to a cropped and resized frame as Base64 or Buffer.
   */
  cropAndResize(
    imageData: string | Buffer,
    roi: { x: number; y: number; width: number; height: number },
    targetWidth: number,
    targetHeight: number
  ): Promise<string | Buffer>;
}

/**
 * Represents a utility for WebSocket communication.
 */
export interface WebSocketUtility {
  /**
   * Sends a payload to the WebSocket server and awaits a response.
   * @param payload - The data to send to the server.
   * @returns A promise resolving to the server's response.
   */
  send(payload: any): Promise<any>;

  /**
   * Closes the WebSocket connection.
   */
  close(): void;
}
