import { Frame, VitalLensOptions, VitalLensResult } from '../types/core';

/**
 * Abstract base class for all method-specific handlers.
 * Subclasses must implement the `process` method.
 */
export abstract class MethodHandler {
  protected options: VitalLensOptions;

  constructor(options: VitalLensOptions) {
    this.options = options;
  }

  /**
   * Processes the provided buffer of frames and optionally uses the recurrent state.
   * @param framesChunk - Frame chunk to process.
   * @param state - Optional recurrent state from previous processing.
   * @returns A promise that resolves to the processing result.
   */
  abstract process(framesChunk: Frame, state?: any): Promise<VitalLensResult>;
}
