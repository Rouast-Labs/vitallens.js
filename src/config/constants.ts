import { CompressionMode } from '../types';

export const VITALLENS_FILE_ENDPOINT =
  'https://api.rouast.com/vitallens-v3/file';
export const VITALLENS_STREAM_ENDPOINT =
  'https://api.rouast.com/vitallens-v3/stream';
export const VITALLENS_RESOLVE_MODEL_ENDPOINT =
  'https://api.rouast.com/vitallens-v3/resolve-model';

export const AGG_WINDOW_SIZE = 10;
export const FDET_DEFAULT_FS_FILE = 0.5;
export const FDET_DEFAULT_FS_STREAM = 1.0;

export const COMPRESSION_MODE: CompressionMode = 'gzip';
