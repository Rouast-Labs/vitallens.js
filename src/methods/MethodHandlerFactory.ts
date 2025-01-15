import { MethodHandler } from './MethodHandler';
import { VitalLensAPIHandler } from './VitalLensAPIHandler';
import { POSHandler } from './POSHandler';
import { GHandler } from './GHandler';
import { CHROMHandler } from './CHROMHandler';
import { VitalLensOptions } from '../types/core';
import { WebSocketClient } from '../utils/WebSocketClient';

interface MethodHandlerDependencies {
  webSocketClient?: WebSocketClient; // Optional dependency for handlers like VitalLensAPIHandler
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
      case 'vitallens': {
        if (!dependencies.webSocketClient) {
          throw new Error('WebSocketClient is required for VitalLensAPIHandler');
        }
        return new VitalLensAPIHandler(dependencies.webSocketClient, options);
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
