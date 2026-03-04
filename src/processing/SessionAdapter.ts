import { MethodConfig, VitalLensResult } from '../types/core';

function iterEntries(obj: any): [string, any][] {
  if (!obj) return [];
  if (typeof obj.entries === 'function') return Array.from(obj.entries());
  return Object.entries(obj);
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

  if (result.vital_signs) {
    for (const [key, val] of Object.entries(result.vital_signs)) {
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

export function toVitalLensResult(
  wasmResult: any,
  incrementalResult?: VitalLensResult
): VitalLensResult {
  const result: VitalLensResult = {
    face: incrementalResult?.face ? { ...incrementalResult.face } : {},
    vital_signs: incrementalResult?.vital_signs
      ? structuredClone(incrementalResult.vital_signs)
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

  // Handle Face Result (mapped from Rust types.rs FaceResult)
  if (wasmResult.face) {
    result.face.coordinates =
      wasmResult.face.coordinates || result.face.coordinates;
    result.face.confidence =
      wasmResult.face.confidence || result.face.confidence;
    if (wasmResult.face.note) result.face.note = wasmResult.face.note;
  }

  // Handle Waveforms (Maps from Rust HashMap<String, WaveformResult>)
  for (const [key, wf] of iterEntries(wasmResult.waveforms)) {
    const waveform = wf as any;
    result.vital_signs[key] = {
      ...result.vital_signs[key],
      data: waveform.data,
      confidence: waveform.confidence,
      unit: waveform.unit,
      note: waveform.note,
    };
  }

  // Handle Vitals (Maps from Rust HashMap<String, VitalResult>)
  for (const [key, v] of iterEntries(wasmResult.vitals)) {
    const vital = v as any;
    if (vital.value !== undefined && vital.value !== null) {
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
