import { WEBSOCKET_ENDPOINT } from "../config/constants";
import { uint8ArrayToBase64 } from "./arrayOps";

const MESSAGE_SIZE = 32 * 1024; // Max. 128 KB per message
const MAX_OVERHEAD = 256; // Max. overhead per message

/**
 * Utility class for managing WebSocket communication.
 */
export class WebSocketClient {
  private socket: WebSocket | null = null;
  private url: string;
  private isConnected: boolean = false;

  constructor(apiKey: string) {
    this.url = `${WEBSOCKET_ENDPOINT}?x-api-key=${encodeURIComponent(apiKey)}`;
  }

  /**
   * Connects to the WebSocket server.
   */
  async connect(): Promise<void> {
    if (this.isConnected) return;

    this.socket = new WebSocket(this.url);

    return new Promise((resolve, reject) => {
      this.socket!.onopen = () => {
        this.isConnected = true;
        console.log("WebSocket connected");
        resolve();
      };

      this.socket!.onerror = (error) => {
        reject(new Error(`WebSocket failed to connect: ${error}`));
      };

      this.socket!.onclose = (event) => {
        console.error(`WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);
        this.isConnected = false;
      };
    });
  }

  /**
   * Sends a payload split into chunks and a final chunk of metadata.
   * @param metadata - The metadata object to include in the final chunk.
   * @param frames - The raw frame data as a Uint8Array.
   * @param state - The state data as a Float32Array (optional).
   * @returns The server's response as a JSON-parsed object.
   */
  async sendFrames(metadata: Record<string, any>, frames: Uint8Array, state?: Float32Array): Promise<any> {
    if (!this.isConnected || !this.socket) {
      throw new Error('WebSocket is not connected');
    }

    const messageId = this.generateUniqueMessageId();
    const base64Frames = uint8ArrayToBase64(frames);
    const availableSizePerMessage = MESSAGE_SIZE - MAX_OVERHEAD;
    const totalChunks = Math.ceil(base64Frames.length / availableSizePerMessage);
    const chunkSize = Math.ceil(base64Frames.length / totalChunks);

    console.log(`Total frame payload size: ${base64Frames.length} bytes, split into ${totalChunks + 1} chunks.`);

    return new Promise((resolve, reject) => {
      let receivedResponse = false;

      this.socket!.onmessage = (event) => {
        try {
          console.log("Received response");
          const response = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
          receivedResponse = true;
          resolve(response);
        } catch (error) {
          reject(new Error(`Failed to parse WebSocket response: ${error}`));
        }
      };

      this.socket!.onerror = (error) => {
        reject(new Error(`WebSocket error: ${error}`));
      };

      // Send chunks sequentially
      for (let i = 0; i < totalChunks; i++) {
        const chunkStart = i * chunkSize;
        const chunkEnd = Math.min((i + 1) * chunkSize, base64Frames.length);
        const chunkData = base64Frames.slice(chunkStart, chunkEnd);

        const chunkPayload = {
          action: "sendFrames",
          messageId,
          chunkIndex: i,
          totalChunks,
          data: chunkData,
        };

        this.socket!.send(JSON.stringify(chunkPayload));
      }

      // Encode state to Base64 if provided
      const base64State = state ? btoa(String.fromCharCode(...new Uint8Array(state.buffer))) : null;

      // Create the final chunk with metadata and state
      const finalChunk: Record<string, any> = {
        action: "sendFrames",
        messageId,
        totalChunks,
        ...metadata,
      };
      if (base64State) {
        finalChunk.state = base64State;
      }

      this.socket!.send(JSON.stringify(finalChunk));
      console.log(`Sent final chunk for message ID: ${messageId}`);

      // Add a timeout to reject the promise if no response is received
      setTimeout(() => {
        if (!receivedResponse) {
          reject(new Error('Timeout waiting for WebSocket response'));
        }
      }, 10000); // 10 seconds timeout
    });
  }

  /**
   * Generates a unique ID for the message batch.
   */
  private generateUniqueMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check connection status
   * @returns true of WebSocket is connected, else false.
   */
  getIsConnected(): boolean {
    return this.isConnected;  
  }

  /**
   * Closes the WebSocket connection.
   */
  close(): void {
    if (this.socket) {
      this.socket.close();
      this.isConnected = false;
    }
  }
}
