import * as tf from "@tensorflow/tfjs";
import { FRAME_PROCESSING } from "../common/config";

export interface FrameBox {
  x: number;    // X-coordinate of the top-left corner of the box
  y: number;    // Y-coordinate of the top-left corner of the box
  width: number; // Width of the box
  height: number; // Height of the box
}

export class FrameProcessor {
  /**
   * Crops and resizes a frame based on the given bounding box.
   * Converts the processed frame to a base64 string.
   *
   * @param canvas - The source canvas element containing the frame.
   * @param frameBox - The bounding box for cropping the frame.
   * @returns A base64 string representing the cropped and resized frame.
   */
  static async processFrame(canvas: HTMLCanvasElement, frameBox: FrameBox): Promise<string> {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get canvas context.");

    // Crop the region defined by the bounding box
    const imageData = ctx.getImageData(
      frameBox.x,
      frameBox.y,
      frameBox.width,
      frameBox.height
    );

    // Create a temporary canvas to handle resizing
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = FRAME_PROCESSING.TARGET_SIZE;
    tempCanvas.height = FRAME_PROCESSING.TARGET_SIZE;

    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) throw new Error("Failed to get temporary canvas context.");

    // Draw the cropped image data onto the temporary canvas
    tempCtx.putImageData(imageData, 0, 0);

    // Use TensorFlow.js to resize the frame for better accuracy
    const tensor = tf.browser.fromPixels(tempCanvas);
    const resizedTensor = tf.image.resizeBilinear(
      tensor,
      [FRAME_PROCESSING.TARGET_SIZE, FRAME_PROCESSING.TARGET_SIZE]
    );

    // Convert the resized tensor back to an image and extract base64
    const resizedCanvas = document.createElement("canvas");
    resizedCanvas.width = FRAME_PROCESSING.TARGET_SIZE;
    resizedCanvas.height = FRAME_PROCESSING.TARGET_SIZE;

    await tf.browser.toPixels(resizedTensor, resizedCanvas);
    const base64Frame = resizedCanvas.toDataURL("image/jpeg").split(",")[1];

    // Clean up tensors to free memory
    tf.dispose([tensor, resizedTensor]);

    return base64Frame;
  }

  /**
   * Converts a batch of frames into base64 strings for API usage.
   *
   * @param canvas - The source canvas element containing the frames.
   * @param frameBoxes - Array of bounding boxes for each frame.
   * @returns An array of base64 strings, one for each processed frame.
   */
  static async processFramesBatch(
    canvas: HTMLCanvasElement,
    frameBoxes: FrameBox[]
  ): Promise<string[]> {
    const base64Frames: string[] = [];
    for (const frameBox of frameBoxes) {
      const base64Frame = await FrameProcessor.processFrame(canvas, frameBox);
      base64Frames.push(base64Frame);
    }
    return base64Frames;
  }
}
