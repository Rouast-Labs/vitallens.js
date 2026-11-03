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
  private coreVersion: string;
  private modelUsed?: string;

  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    core: any,
    methodConfig: MethodConfig,
    options: VitalLensOptions,
    live: boolean = true
  ) {
    this.methodConfig = methodConfig;
    this.options = options;

    const config = toSessionConfig(
      methodConfig,
      options.overrideFpsTarget,
      live
    );
    this.wasmSession = new core.Session(config);
    this.coreVersion = core.coreVersion();
  }

  async processIncrementalResult(
    incrementalResult: VitalLensResult,
    defaultWaveformMode: string,
    returnResult: boolean = true
  ): Promise<VitalLensResult | null> {
    const time = incrementalResult.time ?? [];
    if (time.length === 0) return null;

    if (incrementalResult.model_used) {
      this.modelUsed = incrementalResult.model_used;
    }
    const sessionInput = toSessionInput(incrementalResult);

    // TODO: Expose waveform window configuration to users (e.g., allow custom duration).
    const reqMode = this.options.waveformMode || defaultWaveformMode;
    let wasmMode: unknown = 'Incremental';
    if (reqMode === 'global') {
      wasmMode = 'Global';
    } else if (reqMode === 'windowed') {
      wasmMode = { Windowed: { seconds: 10.0 } };
    }

    const wasmResult = this.wasmSession.processJs(sessionInput, wasmMode);

    if (returnResult) {
      return {
        ...toVitalLensResult(wasmResult, incrementalResult),
        core_version: this.coreVersion,
      };
    }
    return null;
  }

  async getResult(): Promise<VitalLensResult> {
    const wasmResult = this.wasmSession.processJs(
      { timestamp: [], signals: {} },
      'Global'
    );
    return {
      ...toVitalLensResult(wasmResult),
      ...(this.modelUsed && { model_used: this.modelUsed }),
      core_version: this.coreVersion,
    };
  }

  getEmptyResult(): VitalLensResult {
    return {
      face: {},
      vitals: {},
      waveforms: {},
      time: [],
      message: 'Prediction is empty because no face was detected.',
    };
  }

  reset() {
    this.wasmSession.reset();
    this.modelUsed = undefined;
  }
}
