import { MethodManager } from "./methods/MethodManager";
import { WebcamProcessor } from "./io/WebcamProcessor";
import { VideoProcessor } from "./io/VideoProcessor";
import { FrameData } from "./types";

export class VitalLens {
  private methodManager: MethodManager;

  constructor(apiUrl: string) {
    this.methodManager = new MethodManager(apiUrl);
  }

  async analyzeWebcam(videoElement: HTMLVideoElement, method: string): Promise<void> {
    const processor = new WebcamProcessor(async (frames) => {
      const estimator = this.methodManager.getMethod(method);
      await estimator.estimateVitals(frames);
    });

    setInterval(() => {
      const canvas = document.createElement("canvas");
      processor.processFrame(canvas);
    }, 100);
  }

  async analyzeVideoFile(filePath: string, method: string): Promise<void> {
    const videoProcessor = new VideoProcessor();
    const base64Frames = await videoProcessor.processVideo(filePath, "./output");
    // Convert base64 strings to FrameData instances
    const frames: FrameData[] = base64Frames.map((base64) => new FrameData(base64));
    const estimator = this.methodManager.getMethod(method);
    await estimator.estimateVitals(frames);
  }
}
