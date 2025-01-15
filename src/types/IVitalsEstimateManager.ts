import { VitalLensResult } from "./core";

export interface IVitalsEstimateManager {
  processIncrementalResult(incrementalResult: VitalLensResult, sourceId: string): Promise<VitalLensResult>;
  getResult(sourceId: string): VitalLensResult;
}
