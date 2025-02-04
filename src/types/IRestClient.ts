import { VitalLensAPIResponse } from './core';

export interface IRestClient {
  sendFrames(
    metadata: Record<string, unknown>,
    frames: Uint8Array,
    state?: Float32Array
  ): Promise<VitalLensAPIResponse>;
}

/**
 * Type guard to check if an object is an IRestClient.
 * @param client - The object to check.
 * @returns True if the object implements IRestClient.
 */
export function isRestClient(client: unknown): client is IRestClient {
  if (typeof client !== 'object' || client === null) {
    return false;
  }
  const candidate = client as { sendFrames?: unknown; connect?: unknown };
  return (
    typeof candidate.sendFrames === 'function' &&
    typeof candidate.connect !== 'function'
  );
}
