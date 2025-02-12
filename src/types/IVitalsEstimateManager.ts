import { VitalLensResult } from './core';

export interface IVitalsEstimateManager {
  processIncrementalResult(
    incrementalResult: VitalLensResult,
    sourceId: string,
    defaultWaveformMode: string,
    light: boolean
  ): Promise<VitalLensResult>;
  getResult(sourceId: string): Promise<VitalLensResult>;
}
