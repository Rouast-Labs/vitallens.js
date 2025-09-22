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
import {
  adaptiveDetrend,
  movingAverage,
  movingAverageSizeForResponse,
  standardize,
} from '../utils/arrayOps';
import { CALC_HR_MAX, CALC_HR_MIN, CALC_RR_MAX } from '../config/constants';

// Thresholds for circuit breaker
const FALLBACK_BUFFER_THRESHOLD = 100; // Frames
const RESET_BUFFER_THRESHOLD = 300; // Frames

const VITAL_CODES_TO_NAMES: Record<string, Vital> = {
  hr: 'heart_rate',
  rr: 'respiratory_rate',
  ppg: 'ppg_waveform',
  resp: 'respiratory_waveform',
  hrv_sdnn: 'hrv_sdnn',
  hrv_rmssd: 'hrv_rmssd',
  hrv_lfhf: 'hrv_lfhf',
};

/**
 * Handler for processing frames using the VitalLens API via REST.
 */
export class VitalLensAPIHandler extends MethodHandler {
  private client: IRestClient;
  private options: VitalLensOptions;
  private ready = false;
  private requestedModelName?: string;
  private resolvedModelName?: string;
  private consecutiveTimeouts = 0;
  private readonly MAX_CONSECUTIVE_TIMEOUTS = 3;

  constructor(client: IRestClient, options: VitalLensOptions) {
    super(options);
    this.client = client;
    this.options = options;

    if (
      options.method === 'vitallens-1.0' ||
      options.method === 'vitallens-2.0'
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
      .map((code) => VITAL_CODES_TO_NAMES[code])
      .filter(Boolean) as Vital[];

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
        ); // Catches 500, 504 etc.
      }
      throw new VitalLensAPIError(`Error ${response.statusCode}: ${message}`);
    }

    // Parse the successful response
    const parsedResponse = response.body;
    if (
      parsedResponse.vital_signs.ppg_waveform &&
      parsedResponse.vital_signs.respiratory_waveform &&
      parsedResponse.state
    ) {
      const n = parsedResponse.vital_signs.ppg_waveform.data.length;
      const roi = framesChunk.getROI();
      const coords = roi.map((r) => [r.x0, r.y0, r.x1, r.y1]) as [
        number,
        number,
        number,
        number,
      ][];

      return {
        face: {
          coordinates: coords.slice(-n),
          confidence: parsedResponse.face.confidence?.slice(-n),
          note: 'Face detection coordinates for this face, along with live confidence levels.',
        },
        vital_signs: parsedResponse.vital_signs,
        state: parsedResponse.state,
        model_used: parsedResponse.model_used,
        time: framesChunk.getTimestamp().slice(-n),
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

    // Circuit breaker logic
    if (mode === 'stream' && bufferSize) {
      if (bufferSize > RESET_BUFFER_THRESHOLD) {
        // Buffer is too large, reset is necessary.
        throw new VitalLensAPIError(
          `Network instability detected. Frame buffer exceeded ${RESET_BUFFER_THRESHOLD} frames. Resetting stream.`
        );
      }
      // If buffer is large or we are recovering from a timeout, go straight to fallback
      if (
        bufferSize > FALLBACK_BUFFER_THRESHOLD ||
        this.consecutiveTimeouts > 0
      ) {
        console.warn(
          `High latency detected (buffer: ${bufferSize} frames). Attempting fallback recovery.`
        );
        return this._fallbackToLambda(framesChunk, state);
      }
    }

    try {
      const metadata: { origin: string; model?: string } = {
        origin: 'vitallens.js',
        ...(this.requestedModelName && { model: this.requestedModelName }),
      };

      // Send the payload
      const response = (await this.client.sendFrames(
        metadata,
        framesChunk.getUint8Array(),
        mode,
        state
      )) as VitalLensAPIResponse;

      // On success, reset the timeout counter and parse the response
      this.consecutiveTimeouts = 0;
      return this._parseAPIResponse(response, framesChunk);
    } catch (error) {
      // Catch timeout errors to engage the circuit breaker
      if (
        error instanceof Error &&
        (error.message.toLowerCase().includes('timed out') ||
          error.message.toLowerCase().includes('timeout') ||
          error.message.includes('504'))
      ) {
        this.consecutiveTimeouts++;
        console.error(
          `Request timed out (${this.consecutiveTimeouts}/${this.MAX_CONSECUTIVE_TIMEOUTS}). Activating fallback.`
        );
        // If max timeouts reached, throw the fatal reset error
        if (this.consecutiveTimeouts >= this.MAX_CONSECUTIVE_TIMEOUTS) {
          throw new VitalLensAPIError(
            'Persistent network instability. Please check your connection. Resetting stream.'
          );
        }
        return this._fallbackToLambda(framesChunk, state);
      }
      // Re-throw other specific errors
      if (
        error instanceof VitalLensAPIError ||
        error instanceof VitalLensAPIKeyError ||
        error instanceof VitalLensAPIQuotaExceededError
      ) {
        throw error;
      }
      // Wrap unknown errors
      throw new VitalLensAPIError(
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Handle the fallback to the /file Lambda endpoint.
   * @param framesChunk - Frame chunk to send, already in shape (n_frames, 40, 40, 3).
   * @param state - Optional recurrent state from the previous API call.
   * @returns A promise that resolves to the processed result.
   */
  private async _fallbackToLambda(
    framesChunk: Frame,
    state?: Float32Array
  ): Promise<VitalLensResult | undefined> {
    console.log('Executing fallback to /file endpoint.');
    try {
      const metadata: { origin: string; model?: string } = {
        origin: 'vitallens.js',
        ...(this.requestedModelName && { model: this.requestedModelName }),
      };

      // Use the 'file' mode for the client call
      const response = await this.client.sendFrames(
        metadata,
        framesChunk.getUint8Array(),
        'file', // Use the file endpoint
        state
      );

      // Reset timeout counter on successful fallback
      this.consecutiveTimeouts = 0;
      return this._parseAPIResponse(response, framesChunk);
    } catch (error) {
      console.error('Fallback to /file endpoint failed:', error);
      // Increment timeout counter as the fallback also failed
      this.consecutiveTimeouts++;
      if (this.consecutiveTimeouts >= this.MAX_CONSECUTIVE_TIMEOUTS) {
        throw new VitalLensAPIError(
          'Persistent network instability. Please check your connection. Resetting stream.'
        );
      }
      return undefined; // Indicate failure
    }
  }

  /**
   * Postprocess the estimated signal.
   * @param signalType The signal type.
   * @param data The raw estimated signal.
   * @param fps The sampling frequency of the estimated signal.
   * @param light Whether to do only light processing.
   * @returns The filtered signal.
   */
  postprocess(
    signalType: 'ppg' | 'resp',
    data: number[],
    fps: number,
    light: boolean
  ): number[] {
    let windowSize: number;
    let processed;
    if (signalType === 'ppg') {
      processed = light ? data : adaptiveDetrend(data, fps, CALC_HR_MIN / 60);
      windowSize = movingAverageSizeForResponse(fps, CALC_HR_MAX / 60);
    } else {
      processed = data;
      windowSize = movingAverageSizeForResponse(fps, CALC_RR_MAX / 60);
    }

    // Apply the moving average filter.
    processed = movingAverage(processed, windowSize);

    // Standardize the filtered signal.
    if (!light) processed = standardize(processed);

    return processed;
  }
}
