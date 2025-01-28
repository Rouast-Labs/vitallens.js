import { WebSocketClientBase } from "./WebSocketClient.base";

export class WebSocketClient extends WebSocketClientBase<WebSocket> {
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
}
