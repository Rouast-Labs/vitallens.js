import { MethodHandler } from './MethodHandler';
import { Frame, VitalLensOptions, VitalLensResult } from '../types/core';

/**
 * Base class for simple rPPG methods (e.g., POS, CHROM, G).
 */
export abstract class SimpleMethodHandler extends MethodHandler {
  protected signalBuffer: { r: number[]; g: number[]; b: number[] } = {
    r: [],
    g: [],
    b: [],
  };
  private maxBufferSize: number;

  constructor(options: VitalLensOptions) {
    super(options);
    this.maxBufferSize = options.fps * 3; // Assume a 3-second sliding window
  }

  /**
   * Processes a buffer of frames to compute vitals.
   * @param buffer - Array of frames to process.
   * @param state - Optional recurrent state.
   * @returns A promise that resolves to the processed result.
   */
  async process(buffer: Frame[], state?: any): Promise<VitalLensResult> {
    for (const frame of buffer) {
      const frameData = typeof frame.data === 'string' ? frame.data : frame.data.toString('base64');
      this.extractRGBSignal(frameData);
    }

    if (this.signalBuffer.r.length < this.maxBufferSize) {
      throw new Error('Insufficient data to apply the algorithm.');
    }

    const vitals = this.computeVitals();
    return {
      vitals,
      state: {}, // No recurrent state for handcrafted methods
    };
  }

  /**
   * Extracts the average RGB values from a frame and adds them to the signal buffer.
   * @param frameData - Base64 string representing the frame data.
   */
  private extractRGBSignal(frameData: string): void {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const image = new Image();
    image.src = frameData;

    image.onload = () => {
      canvas.width = image.width;
      canvas.height = image.height;
      ctx.drawImage(image, 0, 0);

      const imageData = ctx.getImageData(0, 0, image.width, image.height);
      const { data, width, height } = imageData;

      let r = 0,
        g = 0,
        b = 0;
      const pixelCount = width * height;

      for (let i = 0; i < data.length; i += 4) {
        r += data[i]; // Red
        g += data[i + 1]; // Green
        b += data[i + 2]; // Blue
      }

      this.signalBuffer.r.push(r / pixelCount);
      this.signalBuffer.g.push(g / pixelCount);
      this.signalBuffer.b.push(b / pixelCount);

      // Maintain sliding window size
      if (this.signalBuffer.r.length > this.maxBufferSize) {
        this.signalBuffer.r.shift();
        this.signalBuffer.g.shift();
        this.signalBuffer.b.shift();
      }
    };
  }

  /**
   * Abstract method for subclasses to implement their specific algorithm.
   */
  protected abstract computeVitals(): Record<string, any>;
}
