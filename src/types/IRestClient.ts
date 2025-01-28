import { VitalLensAPIResponse } from "./core";

export interface IRestClient {
  sendFrames(metadata: Record<string, any>, frames: Uint8Array, state?: Float32Array): Promise<VitalLensAPIResponse>;
}

/**
 * Type guard to check if an object is an IRestClient.
 * @param client - The object to check.
 * @returns True if the object implements IRestClient.
 */
export function isRestClient(client: any): client is IRestClient {
  return (
    typeof client === "object" &&
    client !== null &&
    typeof client.sendFrames === "function" &&
    typeof client.connect !== "function" // Ensures it's not a WebSocketClient
  );
}
