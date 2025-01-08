/**
 * Core type definitions for the VitalLens library.
 */

/**
 * Represents a single video frame.
 */
export interface Frame {
  data: string | Buffer; // Base64-encoded string (browser) or Buffer (Node.js)
  timestamp: number; // Timestamp in milliseconds
}

/**
 * Options for configuring the VitalLens library.
 */
export interface VitalLensOptions {
  method: 'vitallens' | 'pos' | 'chrom' | 'g'; // The processing method to use
  fps: number; // Target frames per second
  roi?: {
    x: number; // X-coordinate of the region of interest
    y: number; // Y-coordinate of the region of interest
    width: number; // Width of the region of interest
    height: number; // Height of the region of interest
  };
}

/**
 * Represents the result of processing frames.
 */
export interface VitalLensResult {
  vitals: Record<string, any>; // Key-value pairs of estimated vitals
  state?: any; // Recurrent state to be passed to subsequent processing
}
