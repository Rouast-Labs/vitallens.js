/**
 * Utility class for managing WebSocket communication.
 */
export class WebSocketClient {
  private socket: WebSocket;
  private isConnected: boolean = false;

  constructor(private url: string) {
    this.socket = new WebSocket(this.url);
    this.initialize();
  }

  /**
   * Initializes WebSocket event listeners for connection handling.
   */
  private initialize(): void {
    this.socket.onopen = () => {
      this.isConnected = true;
    };

    this.socket.onclose = () => {
      this.isConnected = false;
    };

    this.socket.onerror = (error) => {
      console.error(`WebSocket error: ${error}`);
    };
  }

  /**
   * Sends a message through the WebSocket and waits for a response.
   * @param payload - The data to send.
   * @returns A promise that resolves with the response.
   */
  async send(payload: any): Promise<any> {
    if (!this.isConnected) {
      throw new Error('WebSocket is not connected');
    }

    return new Promise((resolve, reject) => {
      this.socket.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          resolve(response);
        } catch (error) {
          reject(new Error('Failed to parse WebSocket response'));
        }
      };

      this.socket.onerror = (error) => {
        reject(new Error(`WebSocket error: ${error}`));
      };

      try {
        this.socket.send(JSON.stringify(payload));
      } catch (error) {
        reject(new Error('Failed to send message through WebSocket'));
      }
    });
  }

  /**
   * Closes the WebSocket connection.
   */
  close(): void {
    if (this.isConnected) {
      this.socket.close();
    }
  }
}
