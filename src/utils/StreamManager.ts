import { Frame } from '../types/core';

/**
 * Utility class for managing MediaStream and frame extraction.
 */
export class StreamManager {
  private videoElement: HTMLVideoElement;

  constructor(private stream: MediaStream) {
    this.videoElement = document.createElement('video');
    this.videoElement.srcObject = this.stream;
    this.videoElement.muted = true;
    this.videoElement.playsInline = true;
    this.videoElement.autoplay = true;
  }

  /**
   * Starts capturing frames from the MediaStream.
   * @param frameCallback - Callback function to handle captured frames.
   * @param fps - Target frames per second.
   */
  start(frameCallback: (frame: Frame) => void, fps: number): void {
    const captureInterval = 1000 / fps;

    const captureFrame = () => {
      if (!this.videoElement.videoWidth || !this.videoElement.videoHeight) return;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = this.videoElement.videoWidth;
      canvas.height = this.videoElement.videoHeight;

      ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg');
      frameCallback({ data: dataUrl, timestamp: performance.now() });
    };

    setInterval(captureFrame, captureInterval);
  }

  /**
   * Stops the MediaStream.
   */
  stop(): void {
    const tracks = this.stream.getTracks();
    tracks.forEach((track) => track.stop());
  }
}
