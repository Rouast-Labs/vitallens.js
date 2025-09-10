import { CompressionMode } from '../types';

export const VITALLENS_FILE_ENDPOINT =
  'https://api.rouast.com/vitallens-v3/file';
export const VITALLENS_STREAM_ENDPOINT =
  'https://api.rouast.com/vitallens-v3/stream';
export const VITALLENS_RESOLVE_MODEL_ENDPOINT =
  'https://api.rouast.com/vitallens-v3/resolve-model';

// Vitals estimation constraints [1/min]
export const CALC_HR_MIN = 40;
export const CALC_HR_MAX = 240;
export const CALC_RR_MIN = 1;
export const CALC_RR_MAX = 60;

// Vitals estimation window sizes [s]
export const AGG_WINDOW_SIZE = 10; // Must be smaller or equal to smallest CALC_WINDOW_SIZE
export const CALC_HR_WINDOW_SIZE = 10;
export const CALC_HR_MIN_WINDOW_SIZE = 5;
export const CALC_RR_WINDOW_SIZE = 30;
export const CALC_RR_MIN_WINDOW_SIZE = 10;
export const CALC_HRV_SDNN_MIN_T = 20;
export const CALC_HRV_RMSSD_MIN_T = 20;
export const CALC_HRV_LFHF_MIN_T = 55;

// HRV Frequency Bands [Hz]
export const HRV_LF_BAND: [number, number] = [0.04, 0.15];
export const HRV_HF_BAND: [number, number] = [0.15, 0.4];

// Face detection defaults [Hz]
export const FDET_DEFAULT_FS_FILE = 0.5;
export const FDET_DEFAULT_FS_STREAM = 1.0;

export const COMPRESSION_MODE: CompressionMode = 'gzip';
