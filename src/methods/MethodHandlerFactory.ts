import { MethodHandler } from './MethodHandler';
import { VitalLensAPIHandler } from './VitalLensAPIHandler';
import { POSHandler } from './POSHandler';
import { GHandler } from './GHandler';
import { CHROMHandler } from './CHROMHandler';
import { VitalLensOptions } from '../types/core';
import { IRestClient } from '../types/IRestClient';

interface MethodHandlerDependencies {
  restClient?: IRestClient;
}

/**
 * Factory class for creating method handlers based on the specified method.
 */
export class MethodHandlerFactory {
  /**
   * Creates and returns the appropriate method handler based on the provided options.
   * @param options - Configuration options for the handler.
   * @param dependencies - Optional dependencies required by specific handlers.
   * @returns An instance of the appropriate method handler.
   */
  static createHandler(
    options: VitalLensOptions,
    dependencies: MethodHandlerDependencies = {}
  ): MethodHandler {
    switch (options.method) {
      case 'vitallens':
      case 'vitallens-1.0':
      case 'vitallens-1.1':
      case 'vitallens-2.0': {
        if (!dependencies.restClient) {
          throw new Error('RestClient is required for VitalLensAPIHandler');
        }
        return new VitalLensAPIHandler(dependencies.restClient, options);
      }
      case 'pos':
        return new POSHandler(options);
      case 'g':
        return new GHandler(options);
      case 'chrom':
        return new CHROMHandler(options);
      default:
        throw new Error(`Unsupported method: ${options.method}`);
    }
  }
}
