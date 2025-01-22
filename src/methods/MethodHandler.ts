import { MethodConfig, METHODS_CONFIG } from '../config/methodsConfig';
import { Frame } from '../processing/Frame';
import { VitalLensOptions, VitalLensResult } from '../types/core';

/**
 * Abstract base class for all method-specific handlers.
 * Subclasses must implement the `process` method.
 */
export abstract class MethodHandler {
  protected config: MethodConfig;

  constructor(options: VitalLensOptions) {
    this.config = METHODS_CONFIG[options.method];
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
   * Get the method name. Subclasses must implement this.
   * @returns The method name.
   */
  protected abstract getMethodName(): string;

  /**
   * Processes the provided buffer of frames and optionally uses the recurrent state.
   * @param framesChunk - Frame chunk to process.
   * @param state - Optional recurrent state from previous processing.
   * @returns A promise that resolves to the processing result.
   */
  abstract process(framesChunk: Frame, state?: any): Promise<VitalLensResult | undefined>;
}
