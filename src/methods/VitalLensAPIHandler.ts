import {
  InferenceMode,
  VitalLensAPIResponse,
  VitalLensOptions,
  VitalLensResult,
  MethodConfig,
  Vital,
} from '../types/core';
import { MethodHandler } from './MethodHandler';
import { Frame } from '../processing/Frame';
import {
  VitalLensAPIError,
  VitalLensAPIKeyError,
  VitalLensAPIQuotaExceededError,
} from '../utils/errors';
import { IRestClient, ResolveModelResponse } from '../types/IRestClient';
import { VitalMetadataCache } from '../utils/VitalMetadataCache';

const STREAM_RESET_BUFFER_THRESHOLD = 100; // Frames

/**
 * Handler for processing frames using the VitalLens API via REST.
 */
export class VitalLensAPIHandler extends MethodHandler {
  private client: IRestClient;
  private options: VitalLensOptions;
  private ready = false;
  private requestedModelName?: string;
  private resolvedModelName?: string;

  constructor(client: IRestClient, options: VitalLensOptions) {
    super(options);
    this.client = client;
    this.options = options;

    if (
      options.method.startsWith('vitallens') &&
      options.method !== 'vitallens'
    ) {
      this.requestedModelName = options.method;
    }
  }

  /**
   * Initialise the method.
   */
  async init(): Promise<void> {
    if (this.ready) return;

    try {
      const response = await this.client.resolveModel(this.requestedModelName);
      this._parseAndSetConfig(response);
      this.ready = true;
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('401') || error.message.includes('403'))
      ) {
        throw new VitalLensAPIKeyError(error.message);
      }
      throw new VitalLensAPIError(
        `Failed to initialize VitalLensAPIHandler: ${error}`
      );
    }
  }

  /**
   * Parses the response from /resolve-model and sets the method config.
   * @param response The response from the API.
   */
  private _parseAndSetConfig(response: ResolveModelResponse): void {
    const apiConfig = response.config;

    const supportedVitals = (apiConfig.supported_vitals || [])
      .map((code) => {
        const meta = VitalMetadataCache.getMeta(code);
        return (meta?.id || code) as Vital;
      })
      .filter(Boolean);

    this.config = {
      method: response.resolved_model as MethodConfig['method'],
      fpsTarget: apiConfig.fps_target,
      roiMethod: apiConfig.roi_method,
      inputSize: apiConfig.input_size,
      minWindowLengthState: apiConfig.n_inputs,
      minWindowLength: 16,
      maxWindowLength: 900,
      requiresState: true,
      bufferOffset: 1.5,
      supportedVitals,
    };

    this.resolvedModelName = response.resolved_model;
  }

  /**
   * Cleanup the method.
   */
  async cleanup(): Promise<void> {
    // Nothing to do
  }

  /**
   * Get readiness state.
   * @returns Whether the method is ready for prediction.
   */
  getReady(): boolean {
    return this.ready;
  }

  /**
   * Get the method name. Subclasses must implement this.
   * @returns The method name.
   */
  protected getMethodName(): string {
    return this.resolvedModelName || 'VitalLens API';
  }

  /**
   * Private helper to parse the API response.
   * @param response - The response from the API.
   * @param framesChunk - Frame chunk sent, already in shape (n_frames, 40, 40, 3).
   * @returns A VitalLensResult
   */
  private _parseAPIResponse(
    response: VitalLensAPIResponse,
    framesChunk: Frame
  ): VitalLensResult | undefined {
    if (!response || typeof response.statusCode !== 'number') {
      throw new VitalLensAPIError('Invalid response format');
    }

    if (response.statusCode !== 200) {
      const message = response.body ? response.body.message : 'Unknown error';
      if (response.statusCode === 403) {
        throw new VitalLensAPIKeyError();
      } else if (response.statusCode === 429) {
        throw new VitalLensAPIQuotaExceededError();
      } else if (response.statusCode === 400) {
        throw new VitalLensAPIError(`Parameters missing: ${message}`);
      } else if (response.statusCode === 422) {
        throw new VitalLensAPIError(
          `Issue with provided parameters: ${message}`
        );
      } else if (response.statusCode >= 500) {
        throw new VitalLensAPIError(
          `Error ${response.statusCode} in the API: ${message}`
        );
      }
      throw new VitalLensAPIError(`Error ${response.statusCode}: ${message}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsedResponse = response.body as any;

    const n = parsedResponse.n ?? framesChunk.getTimestamp().length;
    const roi = framesChunk.getROI();
    const coords = roi.map((r) => [r.x0, r.y0, r.x1, r.y1]) as [
      number,
      number,
      number,
      number,
    ][];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vitals: any = parsedResponse.vitals || {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const waveforms: any = parsedResponse.waveforms || {};

    // Backward compatibility for old API structure
    if (parsedResponse.vital_signs) {
      for (const [key, val] of Object.entries(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parsedResponse.vital_signs as Record<string, any>
      )) {
        if (val.data !== undefined) {
          waveforms[key] = val;
        } else if (val.value !== undefined) {
          vitals[key] = val;
        }
      }
    }

    if (Object.keys(vitals).length > 0 || Object.keys(waveforms).length > 0) {
      return {
        face: {
          coordinates: coords.slice(-n),
          confidence: parsedResponse.face?.confidence?.slice(-n),
          note: 'Face detection coordinates for this face, along with live confidence levels.',
        },
        vitals,
        waveforms,
        state: parsedResponse.state,
        model_used: parsedResponse.model_used,
        time: framesChunk.getTimestamp().slice(-n),
        n: parsedResponse.n,
        message:
          'The provided values are estimates and should be interpreted according to the provided confidence levels ranging from 0 to 1. The VitalLens API is not a medical device and its estimates are not intended for any medical purposes.',
      };
    }
    return undefined;
  }

  /**
   * Sends a buffer of frames to the VitalLens API via the selected client and processes the response.
   * @param framesChunk - Frame chunk to send, already in shape (n_frames, 40, 40, 3).
   * @param mode - The inference mode.
   * @param state - Optional recurrent state from the previous API call.
   * @param bufferSize - Optional current size of the buffer.
   * @returns A promise that resolves to the processed result.
   */
  async process(
    framesChunk: Frame,
    mode: InferenceMode,
    state?: Float32Array,
    bufferSize?: number
  ): Promise<VitalLensResult | undefined> {
    if (!this.ready) {
      throw new Error(
        'VitalLensAPIHandler is not initialized. Call init() first.'
      );
    }

    // Circuit breaker logic for stream mode
    if (
      mode === 'stream' &&
      bufferSize &&
      bufferSize > STREAM_RESET_BUFFER_THRESHOLD
    ) {
      throw new VitalLensAPIError(
        `Network instability detected. Frame buffer exceeded ${STREAM_RESET_BUFFER_THRESHOLD} frames. Resetting stream.`
      );
    }

    try {
      const metadata: { origin: string; model?: string } = {
        origin: this.options.origin || 'vitallens.js',
        ...(this.requestedModelName && { model: this.requestedModelName }),
      };

      // Send the payload
      const response = (await this.client.sendFrames(
        metadata,
        framesChunk.getUint8Array(),
        mode,
        state
      )) as VitalLensAPIResponse;

      // Parse the successful response
      return this._parseAPIResponse(response, framesChunk);
    } catch (error) {
      if (
        error instanceof VitalLensAPIError ||
        error instanceof VitalLensAPIKeyError ||
        error instanceof VitalLensAPIQuotaExceededError
      ) {
        throw error;
      }
      throw new VitalLensAPIError(
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }
}
