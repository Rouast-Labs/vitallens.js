export interface VideoProcessingOptions {
  targetFps?: number; // Downsample frames to this FPS // TODO: Change this into an override
  crop?: { x: number; y: number; width: number; height: number }; // Crop coordinates
  scale?: { width: number; height: number }; // Resize dimensions
  trim?: { startFrame: number; endFrame: number }; // Frame range for trimming
  pixelFormat?: string; // Pixel format (default: 'rgb24')
  scaleAlgorithm?: "bicubic" | "bilinear" | "area" | "lanczos"; // Scaling algorithm
}
