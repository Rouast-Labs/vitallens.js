import {
  MethodConfig,
  VitalLensOptions,
  VitalLensResult,
  VitalData,
} from '../types/core';
import { IVitalsEstimateManager } from '../types/IVitalsEstimateManager';
import { getCore } from '../core/wasmProvider';

let core: any = null;
getCore().then((c) => (core = c));

export class VitalsEstimateManager implements IVitalsEstimateManager {
  private sessions: Map<string, any> = new Map();

  constructor(
    private getConfig: () => MethodConfig,
    private options: VitalLensOptions
  ) {}

  private get methodConfig(): MethodConfig {
    return this.getConfig();
  }

  private ensureSession(sourceId: string): any {
    if (!this.sessions.has(sourceId)) {
      if (!core) throw new Error("Wasm core not loaded");
      const config = {
        model_name: this.methodConfig.method,
        supported_vitals: this.methodConfig.supportedVitals,
        fps_target: this.options.overrideFpsTarget ?? this.methodConfig.fpsTarget,
        input_size: this.methodConfig.inputSize || 40,
        n_inputs: this.methodConfig.minWindowLengthState || 16,
        roi_method: this.methodConfig.roiMethod,
        return_waveforms: this.methodConfig.supportedVitals.filter(v => v.includes('waveform')),
      };
      this.sessions.set(sourceId, new core.Session(config));
    }
    return this.sessions.get(sourceId);
  }

  private mapWasmResultToVitalLensResult(wasmResult: any, incrementalResult?: VitalLensResult): VitalLensResult {
    const result: VitalLensResult = {
      face: incrementalResult?.face ? { ...incrementalResult.face } : {},
      vital_signs: incrementalResult?.vital_signs ? JSON.parse(JSON.stringify(incrementalResult.vital_signs)) : {},
      time: wasmResult.timestamp && wasmResult.timestamp.length > 0 ? wasmResult.timestamp : (incrementalResult?.time || []),
      message: wasmResult.message || incrementalResult?.message || '',
      fps: wasmResult.fps || incrementalResult?.fps,
    };

    if (incrementalResult?.model_used) result.model_used = incrementalResult.model_used;
    if (incrementalResult?.display_time) result.display_time = incrementalResult.display_time;

    if (wasmResult.face && Object.keys(wasmResult.face).length > 0) {
      result.face.coordinates = wasmResult.face.coordinates || result.face.coordinates;
      result.face.confidence = wasmResult.face.confidence || result.face.confidence;
      if (wasmResult.face.note) result.face.note = wasmResult.face.note;
    }

    if (wasmResult.waveforms) {
      for (const [key, wf] of Object.entries(wasmResult.waveforms)) {
        const waveform = wf as any;
        result.vital_signs[key] = {
          ...result.vital_signs[key],
          data: waveform.data,
          confidence: waveform.confidence,
          unit: waveform.unit,
          note: waveform.note,
        };
      }
    }

    if (wasmResult.vitals) {
      for (const [key, v] of Object.entries(wasmResult.vitals)) {
        const vital = v as any;
        result.vital_signs[key] = {
          ...result.vital_signs[key],
          value: vital.value,
          confidence: vital.confidence,
          unit: vital.unit,
          note: vital.note,
        };
      }
    }

    return result;
  }

  async processIncrementalResult(
    incrementalResult: VitalLensResult,
    sourceId: string,
    defaultWaveformMode: string,
    light: boolean = true,
    returnResult: boolean = true
  ): Promise<VitalLensResult | null> {
    const session = this.ensureSession(sourceId);
    
    const time = incrementalResult.time ?? [];
    if (time.length === 0) return null;

    const signals: Record<string, any> = {};
    if (incrementalResult.vital_signs) {
      for (const [key, val] of Object.entries(incrementalResult.vital_signs)) {
        if (val.data && val.confidence) {
          const confArray = Array.isArray(val.confidence) ? val.confidence : new Array(val.data.length).fill(val.confidence);
          signals[key] = { data: val.data, confidence: confArray };
        }
      }
    }

    let faceInput: any = undefined;
    if (incrementalResult.face?.coordinates && incrementalResult.face?.confidence) {
      faceInput = {
        coordinates: incrementalResult.face.coordinates,
        confidence: incrementalResult.face.confidence
      };
    }

    const sessionInput = {
      face: faceInput,
      signals: signals,
      timestamp: time
    };

    const reqMode = this.options.waveformMode || defaultWaveformMode;
    let wasmMode: any = "Incremental";
    if (reqMode === 'complete' || reqMode === 'global') wasmMode = "Global";
    else if (reqMode === 'windowed') wasmMode = { Windowed: 10.0 }; 

    const wasmResult = session.processJs(sessionInput, wasmMode);

    if (returnResult) {
       return this.mapWasmResultToVitalLensResult(wasmResult, incrementalResult);
    }
    return null;
  }

  async produceBufferedResults(
    incrementalResult: VitalLensResult,
    sourceId: string,
    defaultWaveformMode: string
  ): Promise<Array<VitalLensResult> | null> {
    
    const processedResult = await this.processIncrementalResult(
      incrementalResult, 
      sourceId, 
      defaultWaveformMode, 
      true, 
      true
    );
    
    if (!processedResult) return null;
    
    const results: VitalLensResult[] = [];
    const nFrames = processedResult.time?.length || 0;
    if (nFrames === 0) return null;

    for (let i = 0; i < nFrames; i++) {
      const singleResult: VitalLensResult = {
        face: {
          coordinates: processedResult.face?.coordinates?.[i] ? [processedResult.face.coordinates[i]] : [],
          confidence: processedResult.face?.confidence?.[i] !== undefined ? [processedResult.face.confidence[i]] : [],
          note: processedResult.face?.note
        },
        vital_signs: {},
        time: [processedResult.time![i]],
        message: processedResult.message || '',
        display_time: processedResult.time![i] + (this.methodConfig.bufferOffset || 0)
      };
      
      for (const [key, value] of Object.entries(processedResult.vital_signs)) {
        if (value.data && value.data[i] !== undefined && Array.isArray(value.confidence) && value.confidence[i] !== undefined) {
          singleResult.vital_signs[key] = {
            data: [value.data[i]],
            confidence: [value.confidence[i] as number],
            unit: value.unit,
            note: value.note
          };
        } else if (value.value !== undefined && i === nFrames - 1) { 
          singleResult.vital_signs[key] = {
            value: value.value,
            confidence: value.confidence,
            unit: value.unit,
            note: value.note
          };
        }
      }
      results.push(singleResult);
    }
    return results;
  }

  async getResult(sourceId: string): Promise<VitalLensResult> {
     const session = this.ensureSession(sourceId);
     const wasmResult = session.processJs({ timestamp: [], signals: {} }, "Global");
     return this.mapWasmResultToVitalLensResult(wasmResult);
  }

  getEmptyResult(): VitalLensResult {
    return {
      face: {},
      vital_signs: {},
      time: [],
      message: 'Prediction is empty because no face was detected.',
    };
  }

  reset(sourceId: string) {
    if (this.sessions.has(sourceId)) {
      this.sessions.get(sourceId).reset();
    }
  }

  resetAll() {
    for (const session of this.sessions.values()) {
      session.reset();
    }
  }
}
