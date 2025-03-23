import { VitalLensResult } from './core';

export interface IVitalsEstimateManager {
  produceBufferedResults(
    incrementalResult: VitalLensResult,
    sourceId: string,
    defaultWaveformMode: string
  ): Promise<Array<VitalLensResult> | null>;
  processIncrementalResult(
    incrementalResult: VitalLensResult,
    sourceId: string,
    defaultWaveformMode: string,
    light: boolean
  ): Promise<VitalLensResult | null>;
  getResult(sourceId: string): Promise<VitalLensResult>;
}
