/**
 * Represents possible video file inputs.
 */
export type VideoInput = string | File | Blob;

/**
 * Options for configuring the VitalLens library.
 */
export interface VitalLensOptions {
  method: 'vitallens' | 'pos' | 'chrom' | 'g';
  apiKey?: string;
  waveformDataMode?: 'incremental' | 'aggregated' | 'complete';
  requestMode?: 'websocket' | 'rest';
  overrideFpsTarget?: number;
  globalRoi?: ROI;
  fDetFs?: number;
}

/**
 * Options for configuring a method.
 */
export interface MethodConfig {
  method: 'vitallens' | 'pos' | 'chrom' | 'g';
  fpsTarget: number;
  roiMethod: 'face' | 'upper_body';
  inputSize?: number;
  minWindowLength: number;
  minWindowLengthState?: number;
  maxWindowLength: number;
  requiresState: boolean;
}

/**
 * Represents the result of a prediction or processing.
 */
export interface VitalLensResult {
  face: {
    coordinates?: Array<[number, number, number, number]>; // (x0, y0, x1, y1) for each frame
    confidence?: number[];
    note?: string;
  };
  vital_signs: {
    heart_rate?: {
      value: number;
      unit: string;
      confidence: number;
      note: string;
    };
    respiratory_rate?: {
      value: number;
      unit: string;
      confidence: number;
      note: string;
    };
    ppg_waveform?: {
      data: number[];
      unit: string;
      confidence: number[];
      note: string;
    };
    respiratory_waveform?: {
      data: number[];
      unit: string;
      confidence: number[];
      note: string;
    };
  };
  time: number[];
  state?: {
    data: Float32Array,
    note: string
  }
  fps?: number;
  estFps?: number;
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
  pixelFormat?: "rgb24";
  scaleAlgorithm?: "bicubic" | "bilinear" | "area" | "lanczos";
}

/**
 * Represents a region of interest (ROI).
 */
export interface ROI {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
