import { VitalLensResult } from "./core";

export interface IRestClient {
  sendFrames(metadata: Record<string, any>, frames: Uint8Array, state?: Float32Array): Promise<VitalLensResult>;
}

/**
 * Type guard to check if an object is an IRestClient.
 * @param client - The object to check.
 * @returns True if the object implements IRestClient.
 */
// TODO: Distinguish from WebSocketClient
export function isRestClient(client: any): client is IRestClient {
  return typeof client.sendFrames === "function";
}
