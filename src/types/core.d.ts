/**
 * Represents possible video file inputs.
 */
export type VideoInput = string | File | Blob;

/**
 * Represents the possible inference modes.
 */
export type InferenceMode = 'stream' | 'file';

/**
 * Represents the vital signs that can be estimated.
 */
export type Vital =
  | 'ppg_waveform'
  | 'heart_rate'
  | 'respiratory_waveform'
  | 'respiratory_rate'
  | 'hrv_sdnn'
  | 'hrv_rmssd'
  | 'hrv_lfhf'
  | 'sbp'
  | 'dbp'
  | 'spo2'
  | (string & {});

/**
 * Represents the rPPG methods.
 */
export type Method = 'vitallens' | 'pos' | 'chrom' | 'g' | (string & {});

/**
 * Options for configuring the VitalLens library.
 */
export interface VitalLensOptions {
  method: Method;
  apiKey?: string;
  proxyUrl?: string;
  origin?: 'vitallens.js' | 'test';
  waveformMode?: 'incremental' | 'windowed' | 'global';
  requestMode?: 'rest';
  overrideFpsTarget?: number;
  globalRoi?: ROI;
  fDetFs?: number;
}

/**
 * Options for configuring a method.
 */
export interface MethodConfig {
  method: Method;
  fpsTarget: number;
  roiMethod: 'face' | 'upper_body' | 'upper_body_cropped' | 'forehead';
  inputSize?: number;
  minWindowLength: number;
  minWindowLengthState?: number;
  maxWindowLength: number;
  requiresState: boolean;
  bufferOffset: number;
  supportedVitals: Vital[];
}

/**
 * Represents a single scalar vital sign.
 */
export interface VitalData {
  value: number;
  unit: string;
  confidence: number;
  note: string;
}

/**
 * Represents a time-series waveform signal.
 */
export interface WaveformData {
  data: number[];
  unit: string;
  confidence: number[];
  note: string;
}

/**
 * Represents the result of a prediction or processing.
 */
export interface VitalLensResult {
  face: {
    coordinates?: Array<[number, number, number, number]>;
    confidence?: number[];
    note?: string;
  };
  vitals: Record<string, VitalData>;
  waveforms: Record<string, WaveformData>;
  n?: number;
  time?: number[];
  display_time?: number;
  state?: {
    data: Float32Array;
    note: string;
  };
  fps?: number;
  est_fps?: number;
  model_used?: string;
  message: string;
}

/**
 * Represents a response from the API.
 */
export interface VitalLensAPIResponse {
  statusCode: number;
  body: VitalLensResult;
}

/**
 * Represents the result of FFmpeg video probe.
 */
export interface VideoProbeResult {
  fps: number;
  totalFrames: number;
  width: number;
  height: number;
  codec: string;
  bitrate: number;
  rotation: number;
  issues: boolean;
}

/**
 * Represents video processing options.
 */
export interface VideoProcessingOptions {
  fpsTarget?: number;
  crop?: ROI;
  scale?: { width: number; height: number };
  trim?: { startFrame: number; endFrame: number };
  preserveAspectRatio?: boolean;
  pixelFormat?: 'rgb24' | 'bgr24';
  scaleAlgorithm?: 'bicubic' | 'bilinear' | 'area' | 'lanczos';
}

/**
 * Represents a region of interest (ROI).
 */
export interface ROI {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  confidence?: number;
}

/**
 * Represents the possible compression modes.
 */
export type CompressionMode = 'none' | 'gzip' | 'deflate';
