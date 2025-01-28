import { VitalLensAPIResponse } from "./core";

export interface IWebSocketClient {
  connect(): Promise<void>;
  sendFrames(metadata: Record<string, any>, frames: Uint8Array, state?: Float32Array): Promise<VitalLensAPIResponse>;
  getIsConnected(): boolean;
  close(): void;
}

/**
 * Type guard to check if an object is an IWebSocketClient.
 * @param client - The object to check.
 * @returns True if the object implements IWebSocketClient.
 */
export function isWebSocketClient(client: any): client is IWebSocketClient {
  return (
    typeof client === "object" &&
    client !== null &&
    typeof client.sendFrames === "function" &&
    typeof client.connect === "function" &&
    typeof client.getIsConnected === "function" &&
    typeof client.close === "function"
  );
}
