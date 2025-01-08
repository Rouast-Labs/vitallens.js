import { MethodHandler } from './MethodHandler';
import { VitalLensAPIHandler } from './VitalLensAPIHandler';
import { POSHandler } from './POSHandler';
import { GHandler } from './GHandler';
import { CHROMHandler } from './CHROMHandler';
import { VitalLensOptions } from '../types/core';

/**
 * Factory class for creating method handlers based on the specified method.
 */
export class MethodHandlerFactory {
  /**
   * Creates and returns the appropriate method handler based on the provided options.
   * @param method - The method to use for vitals estimation (e.g., 'vitallens', 'pos', etc.).
   * @param options - Configuration options for the handler.
   * @returns An instance of the appropriate method handler.
   */
  static createHandler(method: string, options: VitalLensOptions): MethodHandler {
    switch (method) {
      case 'vitallens':
        return new VitalLensAPIHandler(options);
      case 'pos':
        return new POSHandler(options);
      case 'g':
        return new GHandler(options);
      case 'chrom':
        return new CHROMHandler(options);
      default:
        throw new Error(`Unsupported method: ${method}`);
    }
  }
}
