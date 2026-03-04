import { MethodConfig, VitalLensOptions, VitalLensResult } from '../types/core';
import {
  toSessionConfig,
  toSessionInput,
  toVitalLensResult,
} from './SessionAdapter';

export class Session {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private wasmSession: any;
  private methodConfig: MethodConfig;
  private options: VitalLensOptions;

  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    core: any,
    methodConfig: MethodConfig,
    options: VitalLensOptions
  ) {
    this.methodConfig = methodConfig;
    this.options = options;

    const config = toSessionConfig(methodConfig, options.overrideFpsTarget);
    this.wasmSession = new core.Session(config);
  }

  async processIncrementalResult(
    incrementalResult: VitalLensResult,
    defaultWaveformMode: string,
    returnResult: boolean = true
  ): Promise<VitalLensResult | null> {
    const time = incrementalResult.time ?? [];
    if (time.length === 0) return null;

    const sessionInput = toSessionInput(incrementalResult);

    const reqMode = this.options.waveformMode || defaultWaveformMode;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let wasmMode: any = 'Incremental';
    if (reqMode === 'complete' || reqMode === 'global') wasmMode = 'Global';
    else if (reqMode === 'windowed') wasmMode = { Windowed: 10.0 };

    const wasmResult = this.wasmSession.processJs(sessionInput, wasmMode);

    if (returnResult) {
      return toVitalLensResult(wasmResult, incrementalResult);
    }
    return null;
  }

  async produceBufferedResults(
    incrementalResult: VitalLensResult,
    defaultWaveformMode: string
  ): Promise<Array<VitalLensResult> | null> {
    const processedResult = await this.processIncrementalResult(
      incrementalResult,
      defaultWaveformMode,
      true
    );

    if (!processedResult) return null;

    const results: VitalLensResult[] = [];
    const nFrames = processedResult.time?.length || 0;
    if (nFrames === 0) return null;

    for (let i = 0; i < nFrames; i++) {
      const singleResult: VitalLensResult = {
        face: {
          coordinates: processedResult.face?.coordinates?.[i]
            ? [processedResult.face.coordinates[i]]
            : [],
          confidence:
            processedResult.face?.confidence?.[i] !== undefined
              ? [processedResult.face.confidence[i]]
              : [],
          note: processedResult.face?.note,
        },
        vital_signs: {},
        time: [processedResult.time![i]],
        message: processedResult.message || '',
        display_time:
          processedResult.time![i] + (this.methodConfig.bufferOffset || 0),
      };

      for (const [key, value] of Object.entries(processedResult.vital_signs)) {
        if (
          value.data &&
          value.data[i] !== undefined &&
          Array.isArray(value.confidence) &&
          value.confidence[i] !== undefined
        ) {
          singleResult.vital_signs[key] = {
            data: [value.data[i]],
            confidence: [value.confidence[i] as number],
            unit: value.unit,
            note: value.note,
          };
        } else if (value.value !== undefined && i === nFrames - 1) {
          singleResult.vital_signs[key] = {
            value: value.value,
            confidence: value.confidence,
            unit: value.unit,
            note: value.note,
          };
        }
      }
      results.push(singleResult);
    }
    return results;
  }

  async getResult(): Promise<VitalLensResult> {
    const wasmResult = this.wasmSession.processJs(
      { timestamp: [], signals: {} },
      'Global'
    );
    return toVitalLensResult(wasmResult);
  }

  getEmptyResult(): VitalLensResult {
    return {
      face: {},
      vital_signs: {},
      time: [],
      message: 'Prediction is empty because no face was detected.',
    };
  }

  reset() {
    this.wasmSession.reset();
  }
}
