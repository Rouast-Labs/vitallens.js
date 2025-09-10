import { METHODS_CONFIG } from '../config/methodsConfig';
import { Frame } from '../processing/Frame';
import {
  InferenceMode,
  MethodConfig,
  VitalLensOptions,
  VitalLensResult,
} from '../types/core';

/**
 * Abstract base class for all method-specific handlers.
 * Subclasses must implement the `process` method.
 */
export abstract class MethodHandler {
  protected config: MethodConfig;

  constructor(options: VitalLensOptions) {
    // For local methods, the config is immediately available.
    // For API-based methods, this will be a temporary config,
    // and the final one will be fetched and set in the init() method.
    this.config = METHODS_CONFIG[options.method] || ({} as MethodConfig);
  }

  /**
   * Returns the current method configuration.
   * @returns The method configuration.
   */
  public getConfig(): MethodConfig {
    return this.config;
  }

  /**
   * Initialise the method. Subclasses must implement this.
   */
  abstract init(): Promise<void>;

  /**
   * Cleanup the method. Subclasses must implement this.
   */
  abstract cleanup(): Promise<void>;

  /**
   * Get readiness state. Subclasses must implement this.
   * @returns Whether the method is ready for prediction.
   */
  abstract getReady(): boolean;

  /**
   * Postprocess the estimated signal. Subclasses must implement this.
   * @param signalType The signal type.
   * @param data The raw estimated signal.
   * @param fps The sampling frequency of the estimated signal.
   * @param light Whether to do only light processing.
   * @returns The filtered signal.
   */
  abstract postprocess(
    signalType: 'ppg' | 'resp',
    data: number[],
    fps: number,
    light: boolean
  ): number[];

  /**
   * Get the method name. Subclasses must implement this.
   * @returns The method name.
   */
  protected abstract getMethodName(): string;

  /**
   * Processes the provided buffer of frames and optionally uses the recurrent state.
   * @param framesChunk - Frame chunk to process.
   * @param mode - The inference mode.
   * @param state - Optional recurrent state from previous processing.
   * @returns A promise that resolves to the processing result.
   */
  abstract process(
    framesChunk: Frame,
    mode: InferenceMode,
    state?: Float32Array
  ): Promise<VitalLensResult | undefined>;
}
