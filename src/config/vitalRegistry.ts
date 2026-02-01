import {
  estimateHeartRate,
  estimateRespiratoryRate,
  estimateHrv,
  VitalCalculationContext,
} from '../utils/physio';
import {
  CALC_HR_MIN_WINDOW_SIZE,
  CALC_HR_WINDOW_SIZE,
  CALC_RR_MIN_WINDOW_SIZE,
  CALC_RR_WINDOW_SIZE,
  CALC_HRV_SDNN_MIN_T,
  CALC_HRV_SDNN_MAX_T,
  CALC_HRV_RMSSD_MIN_T,
  CALC_HRV_RMSSD_MAX_T,
  CALC_HRV_LFHF_MIN_T,
  CALC_HRV_LFHF_MAX_T,
} from './constants';

export type VitalType = 'provided' | 'derived';

export interface VitalMeta {
  type: VitalType;
  unit: string;
  displayName: string;
  aggregation?: 'mean' | 'min' | null;
  sourceSignal?: string;
  minTime?: number;
  maxTime?: number;
  /**
   * Calculates the vital sign value from a signal segment.
   * @param signal The raw signal data (e.g. PPG).
   * @param fs The sampling frequency.
   * @param context Additional data (timestamps, confidence, estimated HR, etc.).
   */
  calcFunc?: (
    signal: number[],
    fs: number,
    context: VitalCalculationContext
  ) => number | null;
}

export const VITAL_REGISTRY: Record<string, VitalMeta> = {
  // Provided signals (Pass-through from API)
  ppg_waveform: {
    type: 'provided',
    unit: 'unitless',
    displayName: 'PPG Waveform',
    aggregation: null,
  },
  respiratory_waveform: {
    type: 'provided',
    unit: 'unitless',
    displayName: 'Respiratory Waveform',
    aggregation: null,
  },
  sbp: {
    type: 'provided',
    unit: 'mmHg',
    displayName: 'Systolic Blood Pressure',
    aggregation: 'mean',
    maxTime: 10,
  },
  dbp: {
    type: 'provided',
    unit: 'mmHg',
    displayName: 'Diastolic Blood Pressure',
    aggregation: 'mean',
    maxTime: 10,
  },
  spo2: {
    type: 'provided',
    unit: '%',
    displayName: 'Blood Oxygen (SpO2)',
    aggregation: 'mean',
    maxTime: 10,
  },
  // Derived signals (Computed locally)
  heart_rate: {
    type: 'derived',
    unit: 'bpm',
    displayName: 'Heart Rate',
    sourceSignal: 'ppg_waveform',
    minTime: CALC_HR_MIN_WINDOW_SIZE,
    maxTime: CALC_HR_WINDOW_SIZE,
    aggregation: 'mean',
    calcFunc: estimateHeartRate,
  },
  respiratory_rate: {
    type: 'derived',
    unit: 'bpm',
    displayName: 'Respiratory Rate',
    sourceSignal: 'respiratory_waveform',
    minTime: CALC_RR_MIN_WINDOW_SIZE,
    maxTime: CALC_RR_WINDOW_SIZE,
    aggregation: 'mean',
    calcFunc: estimateRespiratoryRate,
  },
  hrv_sdnn: {
    type: 'derived',
    unit: 'ms',
    displayName: 'Heart Rate Variability (SDNN)',
    sourceSignal: 'ppg_waveform',
    minTime: CALC_HRV_SDNN_MIN_T,
    maxTime: CALC_HRV_SDNN_MAX_T,
    aggregation: 'min',
    calcFunc: (sig, fs, ctx) => estimateHrv(sig, fs, 'sdnn', ctx),
  },
  hrv_rmssd: {
    type: 'derived',
    unit: 'ms',
    displayName: 'Heart Rate Variability (RMSSD)',
    sourceSignal: 'ppg_waveform',
    minTime: CALC_HRV_RMSSD_MIN_T,
    maxTime: CALC_HRV_RMSSD_MAX_T,
    aggregation: 'min',
    calcFunc: (sig, fs, ctx) => estimateHrv(sig, fs, 'rmssd', ctx),
  },
  hrv_lfhf: {
    type: 'derived',
    unit: 'ratio',
    displayName: 'Heart Rate Variability (LF/HF)',
    sourceSignal: 'ppg_waveform',
    minTime: CALC_HRV_LFHF_MIN_T,
    maxTime: CALC_HRV_LFHF_MAX_T,
    aggregation: 'min',
    calcFunc: (sig, fs, ctx) => estimateHrv(sig, fs, 'lfhf', ctx),
  },
};
