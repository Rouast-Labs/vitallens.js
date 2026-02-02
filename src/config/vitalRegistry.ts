import {
  estimateHeartRate,
  estimateRespiratoryRate,
  estimateHrv,
  VitalCalculationContext,
} from '../utils/physio';
import {
  CALC_HR_MIN_WINDOW_SIZE,
  CALC_HR_WINDOW_SIZE,
  CALC_HR_MAX,
  CALC_HR_MIN,
  CALC_RR_MIN_WINDOW_SIZE,
  CALC_RR_WINDOW_SIZE,
  CALC_RR_MAX,
  CALC_RR_MIN,
  CALC_HRV_SDNN_MIN_T,
  CALC_HRV_SDNN_MAX_T,
  CALC_HRV_RMSSD_MIN_T,
  CALC_HRV_RMSSD_MAX_T,
  CALC_HRV_LFHF_MIN_T,
  CALC_HRV_LFHF_MAX_T,
  CALC_SBP_MIN,
  CALC_SBP_MAX,
  CALC_DBP_MIN,
  CALC_DBP_MAX,
  CALC_SPO2_MIN,
  CALC_SPO2_MAX,
} from './constants';

export interface VitalMeta {
  type: 'provided' | 'derived';
  unit: string;
  displayName: string;
  modelAliases?: string[];
  constraints?: {
    min?: number;
    max?: number;
  };
  processing?: {
    method: 'detrend' | 'smooth' | 'none';
    standardize?: boolean;
    minWindow?: number;
  };
  derivation?: {
    sourceSignal: string;
    window: {
      required: number;
      size: number;
    };
    confidenceAggregation: 'mean' | 'min';
    calcFunc: (
      signal: number[],
      fs: number,
      context: VitalCalculationContext
    ) => number | null;
  };
}

export const VITAL_REGISTRY: Record<string, VitalMeta> = {
  // Provided signals (Pass-through from API)
  ppg_waveform: {
    type: 'provided',
    unit: 'unitless',
    displayName: 'PPG Waveform',
    modelAliases: ['ppg'],
    constraints: {
      min: CALC_HR_MIN,
      max: CALC_HR_MAX,
    },
    processing: {
      method: 'detrend',
      standardize: true,
      minWindow: CALC_HR_MIN_WINDOW_SIZE,
    },
  },
  respiratory_waveform: {
    type: 'provided',
    unit: 'unitless',
    displayName: 'Respiratory Waveform',
    modelAliases: ['resp'],
    constraints: {
      min: CALC_RR_MIN,
      max: CALC_RR_MAX,
    },
    processing: {
      method: 'smooth',
      standardize: true,
      minWindow: CALC_RR_MIN_WINDOW_SIZE,
    },
  },
  sbp: {
    type: 'provided',
    unit: 'mmHg',
    displayName: 'Systolic Blood Pressure',
    modelAliases: ['sbp', 'bp_sys'],
    constraints: {
      min: CALC_SBP_MIN,
      max: CALC_SBP_MAX,
    },
    processing: {
      method: 'smooth',
      standardize: false,
      minWindow: 10,
    },
  },
  dbp: {
    type: 'provided',
    unit: 'mmHg',
    displayName: 'Diastolic Blood Pressure',
    modelAliases: ['dbp', 'bp_dia'],
    constraints: {
      min: CALC_DBP_MIN,
      max: CALC_DBP_MAX,
    },
    processing: {
      method: 'smooth',
      standardize: false,
      minWindow: 10,
    },
  },
  spo2: {
    type: 'provided',
    unit: '%',
    displayName: 'Blood Oxygen Saturation (SpO2)',
    modelAliases: ['spo2'],
    constraints: {
      min: CALC_SPO2_MIN,
      max: CALC_SPO2_MAX,
    },
    processing: {
      method: 'smooth',
      standardize: false,
      minWindow: 10,
    },
  },
  // Derived signals (Computed locally)
  heart_rate: {
    type: 'derived',
    unit: 'bpm',
    displayName: 'Heart Rate',
    modelAliases: ['hr'],
    constraints: {
      min: CALC_HR_MIN,
      max: CALC_HR_MAX,
    },
    derivation: {
      sourceSignal: 'ppg_waveform',
      window: {
        required: CALC_HR_MIN_WINDOW_SIZE,
        size: CALC_HR_WINDOW_SIZE,
      },
      confidenceAggregation: 'mean',
      calcFunc: estimateHeartRate,
    },
  },
  respiratory_rate: {
    type: 'derived',
    unit: 'bpm',
    displayName: 'Respiratory Rate',
    modelAliases: ['rr'],
    constraints: {
      min: CALC_RR_MIN,
      max: CALC_RR_MAX,
    },
    derivation: {
      sourceSignal: 'respiratory_waveform',
      window: {
        required: CALC_RR_MIN_WINDOW_SIZE,
        size: CALC_RR_WINDOW_SIZE,
      },
      confidenceAggregation: 'mean',
      calcFunc: estimateRespiratoryRate,
    },
  },
  hrv_sdnn: {
    type: 'derived',
    unit: 'ms',
    displayName: 'Heart Rate Variability (SDNN)',
    modelAliases: ['hrv_sdnn', 'sdnn'],
    derivation: {
      sourceSignal: 'ppg_waveform',
      window: {
        required: CALC_HRV_SDNN_MIN_T,
        size: CALC_HRV_SDNN_MAX_T,
      },
      confidenceAggregation: 'min', // TODO
      calcFunc: (sig, fs, ctx) => estimateHrv(sig, fs, 'sdnn', ctx),
    },
  },
  hrv_rmssd: {
    type: 'derived',
    unit: 'ms',
    displayName: 'Heart Rate Variability (RMSSD)',
    modelAliases: ['hrv_rmssd', 'rmssd'],
    derivation: {
      sourceSignal: 'ppg_waveform',
      window: {
        required: CALC_HRV_RMSSD_MIN_T,
        size: CALC_HRV_RMSSD_MAX_T,
      },
      confidenceAggregation: 'min', // TODO
      calcFunc: (sig, fs, ctx) => estimateHrv(sig, fs, 'rmssd', ctx),
    },
  },
  hrv_lfhf: {
    type: 'derived',
    unit: 'ratio',
    displayName: 'Heart Rate Variability (LF/HF)',
    modelAliases: ['hrv_lfhf', 'lfhf'],
    derivation: {
      sourceSignal: 'ppg_waveform',
      window: {
        required: CALC_HRV_LFHF_MIN_T,
        size: CALC_HRV_LFHF_MAX_T,
      },
      confidenceAggregation: 'min', // TODO
      calcFunc: (sig, fs, ctx) => estimateHrv(sig, fs, 'lfhf', ctx),
    },
  },
};

export function getVitalKeyFromCode(code: string): string {
  for (const [key, meta] of Object.entries(VITAL_REGISTRY)) {
    if (key === code || meta.modelAliases?.includes(code)) {
      return key;
    }
  }
  return code;
}
