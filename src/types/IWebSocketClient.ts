import { VitalLensAPIResponse } from './core';

export interface IWebSocketClient {
  connect(): Promise<void>;
  sendFrames(
    metadata: Record<string, unknown>,
    frames: Uint8Array,
    state?: Float32Array
  ): Promise<VitalLensAPIResponse>;
  getIsConnected(): boolean;
  close(): void;
}

/**
 * Type guard to check if an object is an IWebSocketClient.
 * @param client - The object to check.
 * @returns True if the object implements IWebSocketClient.
 */
export function isWebSocketClient(client: unknown): client is IWebSocketClient {
  if (typeof client !== 'object' || client === null) {
    return false;
  }
  const candidate = client as {
    sendFrames?: unknown;
    connect?: unknown;
    getIsConnected?: unknown;
    close?: unknown;
  };
  return (
    typeof candidate.sendFrames === 'function' &&
    typeof candidate.connect === 'function' &&
    typeof candidate.getIsConnected === 'function' &&
    typeof candidate.close === 'function'
  );
}
