/**
 * Utility class for managing WebSocket communication.
 */
export class WebSocketClient {
  private socket: WebSocket | null = null;
  private url: string;
  private isConnected: boolean = false;

  constructor(url: string, apiKey: string) {
    this.url = `${url}?x-api-key=${encodeURIComponent(apiKey)}`;
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

      this.socket!.onclose = () => {
        console.log("WebSocket closed");
        this.isConnected = false;
      };
    });
  }

  /**
   * Sends a payload to the server and waits for a response.
   * @param payload - The data to send.
   * @returns The server's response as a JSON-parsed object.
   */
  async send(payload: Record<string, unknown>): Promise<any> {
    if (!this.isConnected || !this.socket) {
      throw new Error('WebSocket is not connected');
    }

    const message = JSON.stringify(payload);

    return new Promise((resolve, reject) => {
      this.socket!.onmessage = (event) => {
        try {
          console.log("Received response");
          const response = JSON.parse(event.data);
          resolve(response);
        } catch (error) {
          reject(new Error(`Failed to parse WebSocket response: ${error}`));
        }
      };

      this.socket!.onerror = (error) => {
        reject(new Error(`WebSocket error: ${error}`));
      };

      this.socket!.send(message);
    });
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
