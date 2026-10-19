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
// Stream face detection watchdog (seconds). Before the worker reports ready, only warn.
export const FDET_WATCHDOG_TIMEOUT = 8.0;
export const FDET_WATCHDOG_TIMEOUT_NOT_READY = 20.0;
export const FDET_WATCHDOG_MAX_RESTARTS = 2;
export const FDET_MAX_CONSECUTIVE_ERRORS = 3;
// Slow-stage thresholds for diagnostics (milliseconds).
export const SLOW_WORKER_READY_MS = 5000;
export const SLOW_DETECTION_MS = 3000;
export const SLOW_FIRST_FACE_MS = 8000;
export const SLOW_FIRST_RESULT_MS = 8000;
export const SLOW_API_REQUEST_MS = 3000;
// Slow connection detection for stream requests (see ConnectionMonitor).
export const SLOW_CONNECTION_MEDIAN_MS = 1000;
// A single request this slow already counts: the stream resets at 100 queued frames (3.3 s at 30 fps).
export const SLOW_CONNECTION_SINGLE_MS = 2000;
export const SLOW_CONNECTION_MAX_FRAMES = 50;
export const SLOW_CONNECTION_WINDOW = 5;
export const SLOW_CONNECTION_MIN_SAMPLES = 3;
// Frame rates of the performance modes.
export const FPS_ECO = 15;
export const FPS_STANDARD = 30;

export const COMPRESSION_MODE: CompressionMode = 'gzip';

/** Performance mode of the UI components: 'eco' samples at 15 fps, 'standard' at 30 fps. */
export type PerformanceMode = 'eco' | 'standard';
/** Mode the UI components start in. */
export const DEFAULT_PERFORMANCE_MODE: PerformanceMode = 'standard';
