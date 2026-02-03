import {
  estimateRateFromFFT,
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
  CALC_HRV_SDNN_MIN,
  CALC_HRV_SDNN_MAX,
  CALC_HRV_RMSSD_MIN,
  CALC_HRV_RMSSD_MAX,
  CALC_HRV_LFHF_MIN,
  CALC_HRV_LFHF_MAX,
} from './constants';

export interface VitalMeta {
  type: 'provided' | 'derived';
  unit: string;
  displayName: string;
  modelAliases?: string[];
  processing?: {
    method: 'detrend' | 'smooth' | 'none';
    standardize?: boolean;
    minWindow?: number;
    constraints?: {
      fmin?: number;
      fmax?: number;
    };
  };
  derivation?: {
    sourceSignal: string;
    constraints?: {
      min?: number;
      max?: number;
    };
    window: {
      required: number;
      size: number;
    };
    confidenceAggregation: 'mean' | 'min';
    calcFunc: (
      signal: number[],
      fs: number,
      context: VitalCalculationContext
    ) => number | { value: number; confidence: number[] } | null;
  };
}

export const VITAL_REGISTRY: Record<string, VitalMeta> = {
  // Provided signals (Pass-through from API)
  ppg_waveform: {
    type: 'provided',
    unit: 'unitless',
    displayName: 'PPG Waveform',
    modelAliases: ['ppg'],
    processing: {
      method: 'detrend',
      standardize: true,
      minWindow: CALC_HR_MIN_WINDOW_SIZE,
      constraints: {
        fmin: CALC_HR_MIN / 60,
        fmax: CALC_HR_MAX / 60,
      },
    },
  },
  respiratory_waveform: {
    type: 'provided',
    unit: 'unitless',
    displayName: 'Respiratory Waveform',
    modelAliases: ['resp'],
    processing: {
      method: 'smooth',
      standardize: true,
      minWindow: CALC_RR_MIN_WINDOW_SIZE,
      constraints: {
        fmin: CALC_RR_MIN / 60,
        fmax: CALC_RR_MAX / 60,
      },
    },
  },
  sbp: {
    type: 'provided',
    unit: 'mmHg',
    displayName: 'Systolic Blood Pressure',
    modelAliases: ['sbp', 'bp_sys'],
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
    derivation: {
      sourceSignal: 'ppg_waveform',
      window: {
        required: CALC_HR_MIN_WINDOW_SIZE,
        size: CALC_HR_WINDOW_SIZE,
      },
      constraints: {
        min: CALC_HR_MIN,
        max: CALC_HR_MAX,
      },
      confidenceAggregation: 'mean',
      calcFunc: (signal, fs) => {
        return estimateRateFromFFT(
          signal,
          fs,
          CALC_HR_MIN / 60,
          CALC_HR_MAX / 60,
          0.5 / 60
        );
      },
    },
  },
  respiratory_rate: {
    type: 'derived',
    unit: 'bpm',
    displayName: 'Respiratory Rate',
    modelAliases: ['rr'],
    derivation: {
      sourceSignal: 'respiratory_waveform',
      window: {
        required: CALC_RR_MIN_WINDOW_SIZE,
        size: CALC_RR_WINDOW_SIZE,
      },
      constraints: {
        min: CALC_RR_MIN,
        max: CALC_RR_MAX,
      },
      confidenceAggregation: 'mean',
      calcFunc: (signal, fs) => {
        return estimateRateFromFFT(
          signal,
          fs,
          CALC_RR_MIN / 60,
          CALC_RR_MAX / 60,
          0.25 / 60
        );
      },
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
      constraints: {
        min: CALC_HRV_SDNN_MIN,
        max: CALC_HRV_SDNN_MAX,
      },
      confidenceAggregation: 'min',
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
      constraints: {
        min: CALC_HRV_RMSSD_MIN,
        max: CALC_HRV_RMSSD_MAX,
      },
      confidenceAggregation: 'min',
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
      constraints: {
        min: CALC_HRV_LFHF_MIN,
        max: CALC_HRV_LFHF_MAX,
      },
      confidenceAggregation: 'min',
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
