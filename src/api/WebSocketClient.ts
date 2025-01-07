// Handles WebSocket-based communication for VitalLens API.

export interface FramePayload {
  frames: string; // Base64 string of video data
  state?: string; // Optional recurrent state
}

export interface ProcessingResult {
  result: { [key: string]: any }; // Inference results
  newState?: string; // Updated recurrent state, if applicable
}

export class WebSocketClient {
  private socket: WebSocket | null = null;
  private endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        console.warn("WebSocket is already connected.");
        resolve();
        return;
      }

      this.socket = new WebSocket(this.endpoint);

      this.socket.onopen = () => {
        console.log("WebSocket connected.");
        resolve();
      };

      this.socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        reject(error);
      };

      this.socket.onclose = () => {
        console.log("WebSocket disconnected.");
        this.socket = null;
      };
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      console.log("WebSocket connection closed.");
    } else {
      console.warn("No active WebSocket connection to close.");
    }
  }

  sendFrames(payload: FramePayload): Promise<ProcessingResult> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        return reject(new Error("WebSocket is not connected."));
      }

      const message = JSON.stringify({ action: "sendFrames", data: payload });
      this.socket.send(message);

      this.socket.onmessage = (event) => {
        try {
          const data: ProcessingResult = JSON.parse(event.data);
          resolve(data);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
          reject(error);
        }
      };

      this.socket.onerror = (error) => {
        console.error("WebSocket error during sendFrames:", error);
        reject(error);
      };
    });
  }
}
