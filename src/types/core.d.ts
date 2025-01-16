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
  overrideFpsTarget?: number;
  globalRoi?: ROI;
  fDetFs?: number;
}

/**
 * Represents the result of a prediction or processing.
 */
export interface VitalLensResult {
  vitals: {
    ppgWaveform?: number[],
    respiratoryWaveform?: number[],
    heartRate?: number;
    respiratoryRate?: number; 
  };
  time: number[];
  state?: any;
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
  x: number;
  y: number;
  width: number;
  height: number;
}
