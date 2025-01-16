import { VitalLensResult } from "./core";

export interface IVitalsEstimateManager {
  processIncrementalResult(incrementalResult: VitalLensResult, sourceId: string, defaultWaveformDataMode: string): Promise<VitalLensResult>;
  getResult(sourceId: string): VitalLensResult;
}
