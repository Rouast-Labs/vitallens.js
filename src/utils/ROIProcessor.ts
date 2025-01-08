import sharp from 'sharp'; // For Node.js image processing
import { isBrowser } from './EnvironmentUtils';

/**
 * Utility class for processing Region of Interest (ROI) in video frames.
 * Handles cropping and resizing frames to the desired dimensions.
 */
export class ROIProcessor {
  /**
   * Crops and resizes the frame to match the specified ROI and target dimensions.
   * Works for both browser and Node.js environments.
   * @param imageData - Base64 string (browser) or Buffer (Node.js) of the frame.
   * @param roi - The region of interest to crop.
   * @param targetWidth - The width to resize the cropped ROI to.
   * @param targetHeight - The height to resize the cropped ROI to.
   * @returns A promise that resolves to the processed frame as a Base64 string (browser) or Buffer (Node.js).
   */
  async cropAndResize(
    imageData: string | Buffer,
    roi: { x: number; y: number; width: number; height: number },
    targetWidth: number,
    targetHeight: number
  ): Promise<string | Buffer> {
    if (isBrowser()) {
      return this.cropAndResizeBrowser(imageData as string, roi, targetWidth, targetHeight);
    } else {
      return await this.cropAndResizeNode(imageData as Buffer, roi, targetWidth, targetHeight);
    }
  }

  /**
   * Crops and resizes the frame in a browser environment.
   * @param base64Image - Base64-encoded string of the frame.
   * @param roi - The region of interest to crop.
   * @param targetWidth - The width to resize the cropped ROI to.
   * @param targetHeight - The height to resize the cropped ROI to.
   * @returns A promise that resolves to the processed frame as a Base64 string.
   */
  private async cropAndResizeBrowser(
    base64Image: string,
    roi: { x: number; y: number; width: number; height: number },
    targetWidth: number,
    targetHeight: number
  ): Promise<string> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context is not available');

    const img = new Image();
    img.src = base64Image;

    return new Promise<string>((resolve, reject) => {
      img.onload = () => {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        ctx.drawImage(
          img,
          roi.x,
          roi.y,
          roi.width,
          roi.height,
          0,
          0,
          targetWidth,
          targetHeight
        );
        resolve(canvas.toDataURL('image/jpeg'));
      };

      img.onerror = (err) => {
        reject(new Error('Failed to load image for cropping and resizing'));
      };
    });
  }

  /**
   * Crops and resizes the frame in a Node.js environment.
   * @param bufferImage - Buffer of the frame data.
   * @param roi - The region of interest to crop.
   * @param targetWidth - The width to resize the cropped ROI to.
   * @param targetHeight - The height to resize the cropped ROI to.
   * @returns A promise that resolves to the processed frame as a Buffer.
   */
  private async cropAndResizeNode(
    bufferImage: Buffer,
    roi: { x: number; y: number; width: number; height: number },
    targetWidth: number,
    targetHeight: number
  ): Promise<Buffer> {
    return sharp(bufferImage)
      .extract({ left: roi.x, top: roi.y, width: roi.width, height: roi.height })
      .resize(targetWidth, targetHeight)
      .toBuffer();
  }
}
