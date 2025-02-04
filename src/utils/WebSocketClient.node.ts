import WebSocket from 'ws';
import { WebSocketClientBase } from './WebSocketClient.base';
import { VITALLENS_WEBSOCKET_ENDPOINT } from '../config/constants';

export class WebSocketClient extends WebSocketClientBase<WebSocket> {
  protected getUrl(apiKey: string): string {
    const websocketEndpoint =
      process.env.VITALLENS_WEBSOCKET_ENDPOINT || VITALLENS_WEBSOCKET_ENDPOINT;
    return `${websocketEndpoint}?x-api-key=${encodeURIComponent(apiKey)}`;
  }
  async connect(): Promise<void> {
    if (this.isConnected) return;

    this.socket = new WebSocket(this.url);

    return new Promise((resolve, reject) => {
      this.socket!.on('open', () => {
        this.isConnected = true;
        console.log('WebSocket connected');
        resolve();
      });

      this.socket!.on('error', (error: Error) => {
        reject(new Error(`WebSocket failed to connect: ${error.message}`));
      });

      this.socket!.on('close', (code: number, reason: Buffer) => {
        console.error(
          `WebSocket closed. Code: ${code}, Reason: ${reason.toString()}`
        );
        this.isConnected = false;
      });
    });
  }
}
