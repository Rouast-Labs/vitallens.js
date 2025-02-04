import { VitalLensResult } from './core';

export interface IVitalsEstimateManager {
  processIncrementalResult(
    incrementalResult: VitalLensResult,
    sourceId: string,
    defaultWaveformMode: string
  ): Promise<VitalLensResult>;
  getResult(sourceId: string): Promise<VitalLensResult>;
}
