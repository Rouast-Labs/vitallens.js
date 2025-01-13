/**
 * Represents possible video file inputs.
 */
export type VideoInput = string | File | Blob;

/**
 * Represents a single frame in the video processing pipeline.
 */
export interface Frame {
  data: ImageData | HTMLCanvasElement | string; // Raw data, canvas, or base64
  timestamp: number; // Timestamp of the frame
}

/**
 * Options for configuring the VitalLens library.
 */
export interface VitalLensOptions {
  method: 'vitallens' | 'pos' | 'chrom' | 'g'; // The processing method to use
  overrideFpsTarget?: number; // Optionally override method's default fpsTarget
  roi?: {
    x: number; // X-coordinate of the region of interest
    y: number; // Y-coordinate of the region of interest
    width: number; // Width of the region of interest
    height: number; // Height of the region of interest
    bufferSize?: number; // Maximum buffer size for frames
  };
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

export interface VideoProcessingOptions {
  fpsTarget?: number; // Downsample frames to this fps
  crop?: { x: number; y: number; width: number; height: number }; // Crop coordinates
  scale?: { width: number; height: number }; // Resize dimensions
  trim?: { startFrame: number; endFrame: number }; // Frame range for trimming
  pixelFormat: "rgb24";
  scaleAlgorithm: "bicubic" | "bilinear" | "area" | "lanczos";
}
