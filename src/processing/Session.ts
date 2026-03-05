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
      return toVitalLensResult(wasmResult, incrementalResult);
    }
    return null;
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
      vitals: {},
      waveforms: {},
      time: [],
      message: 'Prediction is empty because no face was detected.',
    };
  }

  reset() {
    this.wasmSession.reset();
  }
}
