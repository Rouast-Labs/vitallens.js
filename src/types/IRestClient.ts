import { InferenceMode, VitalLensAPIResponse } from './core';

export interface ResolveModelResponse {
  resolved_model: string;
  config: {
    n_inputs: number;
    input_size: number;
    fps_target: number;
    roi_method: 'face' | 'upper_body_cropped' | 'forehead';
    supported_vitals: string[];
  };
}

export interface IRestClient {
  resolveModel(requestedModel?: string): Promise<ResolveModelResponse>;
  sendFrames(
    metadata: Record<string, unknown>,
    frames: Uint8Array,
    mode: InferenceMode,
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
