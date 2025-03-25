import {
  InferenceMode,
  VitalLensAPIResponse,
  VitalLensOptions,
  VitalLensResult,
} from '../types/core';
import { MethodHandler } from './MethodHandler';
import { Frame } from '../processing/Frame';
import {
  VitalLensAPIError,
  VitalLensAPIKeyError,
  VitalLensAPIQuotaExceededError,
} from '../utils/errors';
import { IRestClient } from '../types/IRestClient';
import {
  adaptiveDetrend,
  movingAverage,
  movingAverageSizeForResponse,
  standardize,
} from '../utils/arrayOps';
import { CALC_HR_MAX, CALC_HR_MIN, CALC_RR_MAX } from '../config/constants';

/**
 * Handler for processing frames using the VitalLens API via REST.
 */
export class VitalLensAPIHandler extends MethodHandler {
  private client: IRestClient;

  constructor(client: IRestClient, options: VitalLensOptions) {
    super(options);
    this.client = client;
  }

  /**
   * Initialise the method.
   */
  async init(): Promise<void> {
    // Nothing to do
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
    return true; // REST client is always ready
  }

  /**
   * Get the method name. Subclasses must implement this.
   * @returns The method name.
   */
  protected getMethodName(): string {
    return 'VitalLens API';
  }

  /**
   * Sends a buffer of frames to the VitalLens API via the selected client and processes the response.
   * @param framesChunk - Frame chunk to send, already in shape (n_frames, 40, 40, 3).
   * @param mode - The inference mode.
   * @param state - Optional recurrent state from the previous API call.
   * @returns A promise that resolves to the processed result.
   */
  async process(
    framesChunk: Frame,
    mode: InferenceMode,
    state?: Float32Array
  ): Promise<VitalLensResult | undefined> {
    try {
      // Store the roi.
      const roi = framesChunk.getROI();

      // Send the payload
      const response = (await this.client.sendFrames(
        {
          origin: 'vitallens.js',
        },
        framesChunk.getUint8Array(),
        mode,
        state
      )) as VitalLensAPIResponse;

      // Parse the response
      if (!response || typeof response.statusCode !== 'number') {
        throw new VitalLensAPIError('Invalid response format');
      }

      // Handle errors based on status code
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
        } else if (response.statusCode === 500) {
          throw new VitalLensAPIError(`Error occurred in the API: ${message}`);
        } else {
          throw new VitalLensAPIError(
            `Error ${response.statusCode}: ${message}`
          );
        }
      }

      // Parse the successful response
      const parsedResponse = response.body;
      if (
        parsedResponse.vital_signs.ppg_waveform &&
        parsedResponse.vital_signs.respiratory_waveform &&
        parsedResponse.state
      ) {
        const n = parsedResponse.vital_signs.ppg_waveform.data.length;
        return {
          face: {
            coordinates: (
              roi.map((roi) => [roi.x0, roi.y0, roi.x1, roi.y1]) as [
                number,
                number,
                number,
                number,
              ][]
            ).slice(-n),
            confidence: parsedResponse.face.confidence?.slice(-n),
            note: 'Face detection coordinates for this face, along with live confidence levels.',
          },
          vital_signs: parsedResponse.vital_signs,
          state: parsedResponse.state,
          time: framesChunk.getTimestamp().slice(-n),
          message:
            'The provided values are estimates and should be interpreted according to the provided confidence levels ranging from 0 to 1. The VitalLens API is not a medical device and its estimates are not intended for any medical purposes.',
        };
      } else {
        return undefined;
      }
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
