import { MethodBase } from "./MethodBase";
import { WebSocketClient } from "../api/WebSocketClient";
import { FrameData } from "../types";

export class VitalLensAPI implements MethodBase {
  private wsClient: WebSocketClient;

  constructor(apiUrl: string) {
    this.wsClient = new WebSocketClient(apiUrl);
  }

  async estimateVitals(frames: FrameData[]): Promise<{ [key: string]: any }> {
    // Concatenate all frame data into a single base64 string
    const base64Frames = frames.map((frame) => frame.toBase64()).join("");

    // Ensure WebSocketClient receives the correct argument
    await this.wsClient.connect();
    const result = await this.wsClient.sendFrames(base64Frames); // Pass only the base64 string
    this.wsClient.disconnect();
    return result;
  }
}
