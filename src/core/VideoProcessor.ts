import { Frame, VitalLensOptions } from '../types/core';
import FFmpegWrapper from '../utils/FFmpegWrapper';

/**
 * Handles video processing, including frame capture and preprocessing.
 */
export class VideoProcessor {
  constructor(private options: VitalLensOptions) {}

  /**
   * Starts capturing frames from a MediaStream.
   * The stream is not manipulated, ensuring compatibility with client-managed streams.
   * @param stream - The MediaStream to capture frames from.
   * @param frameCallback - Callback invoked for each captured frame.
   * @param existingVideoElement - Optional video element if the client is already rendering the stream.
   */
  startStreamCapture(
    stream: MediaStream,
    frameCallback: (frame: Frame) => void,
    existingVideoElement?: HTMLVideoElement
  ): void {
    const video = existingVideoElement || document.createElement('video');
    if (!existingVideoElement) {
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      document.body.appendChild(video); // Only add the video if we created it
    }

    video.onloadedmetadata = () => {
      if (!existingVideoElement) {
        video.play();
      }
      const captureInterval = 1000 / this.options.fps;

      setInterval(() => {
        if (!video.videoWidth || !video.videoHeight) return;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        frameCallback({ data: dataUrl, timestamp: performance.now() });
      }, captureInterval);
    };
  }

  /**
   * Extracts frames from a video file.
   * @param filePath - Path to the video file.
   * @returns A promise resolving to an array of frames.
   */
  async extractFramesFromFile(filePath: string): Promise<Frame[]> {
    const ffmpeg = new FFmpegWrapper();

    // Initialize FFmpegWrapper
    await ffmpeg.init();

    // Call `readVideo` to process the video
    const rawBuffer = await ffmpeg.readVideo(filePath, {
      targetFps: this.options.fps,
      crop: this.options.roi, // Assuming `roi` corresponds to the `crop` option
      pixelFormat: "rgb24",
    });

    // TODO: Convert `rawBuffer` into TensorFlow.js tensors
    // Placeholder for future implementation
    console.warn("TensorFlow.js tensor conversion not yet implemented.");

    return []; // Return an empty array for now
  }
}
