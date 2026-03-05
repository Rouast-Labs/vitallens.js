import { MethodConfig, VitalLensResult } from '../types/core';

function iterEntries(obj: unknown): [string, unknown][] {
  if (!obj) return [];
  if (
    typeof (obj as { entries?: () => IterableIterator<[string, unknown]> })
      .entries === 'function'
  ) {
    return Array.from(
      (obj as { entries: () => IterableIterator<[string, unknown]> }).entries()
    );
  }
  if (typeof obj === 'object') {
    return Object.entries(obj as Record<string, unknown>);
  }
  return [];
}

export function toSessionConfig(
  methodConfig: MethodConfig,
  overrideFpsTarget?: number
) {
  const supportedVitals = methodConfig.supportedVitals || [];
  return {
    model_name: methodConfig.method,
    supported_vitals: supportedVitals,
    fps_target: overrideFpsTarget ?? methodConfig.fpsTarget,
    input_size: methodConfig.inputSize || 40,
    n_inputs: methodConfig.minWindowLengthState || 16,
    roi_method: methodConfig.roiMethod,
    return_waveforms: supportedVitals.filter((v) => v.includes('waveform')),
  };
}

export function toSessionInput(result: VitalLensResult) {
  const signals: Record<string, unknown> = {};

  if (result.waveforms) {
    for (const [key, val] of Object.entries(result.waveforms)) {
      if (val.data && val.confidence) {
        const confArray = Array.isArray(val.confidence)
          ? val.confidence
          : new Array(val.data.length).fill(val.confidence);
        signals[key] = { data: val.data, confidence: confArray };
      }
    }
  }

  let faceInput: unknown = undefined;
  if (result.face?.coordinates && result.face?.confidence) {
    faceInput = {
      coordinates: result.face.coordinates,
      confidence: result.face.confidence,
    };
  }

  return {
    face: faceInput,
    signals: signals,
    timestamp: result.time ?? [],
  };
}

interface WasmResult {
  timestamp?: number[];
  message?: string;
  fps?: number;
  face?: {
    coordinates?: [number, number, number, number][];
    confidence?: number[];
    note?: string;
  };
  waveforms?: Record<
    string,
    { data: number[]; confidence: number[]; unit: string; note: string }
  >;
  vitals?: Record<
    string,
    { value: number; confidence: number; unit: string; note: string }
  >;
}

export function toVitalLensResult(
  wasmResult: WasmResult,
  incrementalResult?: VitalLensResult
): VitalLensResult {
  const result: VitalLensResult = {
    face: incrementalResult?.face ? { ...incrementalResult.face } : {},
    vitals: incrementalResult?.vitals
      ? structuredClone(incrementalResult.vitals)
      : {},
    waveforms: incrementalResult?.waveforms
      ? structuredClone(incrementalResult.waveforms)
      : {},
    time:
      wasmResult.timestamp && wasmResult.timestamp.length > 0
        ? wasmResult.timestamp
        : incrementalResult?.time || [],
    message: wasmResult.message || incrementalResult?.message || '',
    fps: wasmResult.fps || incrementalResult?.fps,
  };

  if (incrementalResult?.model_used)
    result.model_used = incrementalResult.model_used;
  if (incrementalResult?.display_time)
    result.display_time = incrementalResult.display_time;

  if (wasmResult.face) {
    result.face.coordinates =
      wasmResult.face.coordinates || result.face.coordinates;
    result.face.confidence =
      wasmResult.face.confidence || result.face.confidence;
    if (wasmResult.face.note) result.face.note = wasmResult.face.note;
  }

  for (const [key, wf] of iterEntries(wasmResult.waveforms)) {
    const waveform = wf as {
      data: number[];
      confidence: number[];
      unit: string;
      note: string;
    };
    result.waveforms[key] = {
      data: waveform.data,
      confidence: waveform.confidence,
      unit: waveform.unit,
      note: waveform.note,
    };
  }

  for (const [key, v] of iterEntries(wasmResult.vitals)) {
    const vital = v as {
      value?: number;
      confidence: number;
      unit: string;
      note: string;
    };
    if (vital.value !== undefined && vital.value !== null) {
      result.vitals[key] = {
        value: vital.value,
        confidence: vital.confidence,
        unit: vital.unit,
        note: vital.note,
      };
    }
  }

  return result;
}
