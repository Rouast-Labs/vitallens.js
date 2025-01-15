/**
 * Represents possible video file inputs.
 */
export type VideoInput = string | File | Blob;

/**
 * Options for configuring the VitalLens library.
 */
export interface VitalLensOptions {
  // TODO: Api key
  method: 'vitallens' | 'pos' | 'chrom' | 'g'; // The processing method to use
  overrideFpsTarget?: number; // Optionally override method's default fpsTarget
  globalRoi?: ROI, // Optional global roi
  fDetFs?: number // Optional face detection frequency
}

/**
 * Represents the result of a prediction or processing.
 */
export interface VitalLensResult {
  vitals: {
    heartRate?: number;
    respiratoryRate?: number;
    [key: string]: any; // Extendable for other vital metrics
  };
  state?: any; // Recurrent state for continued processing
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
  fpsTarget?: number; // Downsample frames to this fps
  crop?: ROI; // Crop coordinates
  scale?: { width: number; height: number }; // Resize dimensions
  trim?: { startFrame: number; endFrame: number }; // Frame range for trimming in terms of original video indices.
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
