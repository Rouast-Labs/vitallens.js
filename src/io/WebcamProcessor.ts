import { FrameProcessor } from "../processing/FrameProcessor";
import { FrameData } from "../types";

export class WebcamProcessor {
  private buffer: HTMLCanvasElement[] = [];
  private isProcessing = false;

  constructor(private sendToWebSocket: (frames: string[]) => Promise<void>) {}

  async processFrame(canvas: HTMLCanvasElement): Promise<void> {
    this.buffer.push(canvas);
    if (!this.isProcessing) {
      this.isProcessing = true;
      await this.flushBuffer();
      this.isProcessing = false;
    }
  }

  private async flushBuffer(): Promise<void> {
    const frames = await Promise.all(
      this.buffer.map(async (canvas) => {
        const base64 = await FrameProcessor.processFrame(canvas);
        return new FrameData(base64);
      })
    );
    this.buffer = [];
    await this.sendToWebSocket(frames);
  }
}