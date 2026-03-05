import { VitalLensResult } from '../types';

interface BufferedPoint {
  value: number;
  confidence: number;
  displayTime: number;
}

export class WaveformPlayer {
  private ppgQueue: BufferedPoint[] = [];
  private respQueue: BufferedPoint[] = [];

  // Clean arrays (no nulls)
  private ppgHistory: number[] = [];
  private ppgConfHistory: number[] = [];
  private respHistory: number[] = [];
  private respConfHistory: number[] = [];

  private timeAnchor: { videoTime: number; realTime: number } | null = null;
  private playbackLoopId: number | null = null;

  constructor(
    private onUpdate: (
      ppgHistory: number[],
      ppgConfHistory: number[],
      respHistory: number[],
      respConfHistory: number[]
    ) => void,
    private bufferOffset: number = 0.15,
    private windowSize: number = 8.0,
    private fps: number = 15
  ) {}

  public setFps(fps: number) {
    this.fps = fps;
  }

  public addData(result: VitalLensResult) {
    const ppgChunk = result.waveforms?.ppg_waveform?.data ?? [];
    const ppgConfs = result.waveforms?.ppg_waveform?.confidence ?? [];
    const respChunk = result.waveforms?.respiratory_waveform?.data ?? [];
    const respConfs = result.waveforms?.respiratory_waveform?.confidence ?? [];
    const times = result.time ?? [];

    if (times.length === 0) return;

    if (!this.timeAnchor) {
      this.timeAnchor = {
        videoTime: times[0],
        realTime: performance.now() / 1000,
      };
      this.start();
    }

    const ppgConfArray = Array.isArray(ppgConfs)
      ? ppgConfs
      : new Array(ppgChunk.length).fill(ppgConfs);
    const respConfArray = Array.isArray(respConfs)
      ? respConfs
      : new Array(respChunk.length).fill(respConfs);

    for (let i = 0; i < times.length; i++) {
      const targetDisplayTime =
        this.timeAnchor.realTime +
        (times[i] - this.timeAnchor.videoTime) +
        this.bufferOffset;
      if (i < ppgChunk.length) {
        this.ppgQueue.push({
          value: ppgChunk[i],
          confidence: ppgConfArray[i],
          displayTime: targetDisplayTime,
        });
      }
      if (i < respChunk.length) {
        this.respQueue.push({
          value: respChunk[i],
          confidence: respConfArray[i],
          displayTime: targetDisplayTime,
        });
      }
    }
  }

  private start() {
    if (this.playbackLoopId !== null) return;

    const loop = () => {
      const now = performance.now() / 1000;
      let hasNewData = false;

      while (this.ppgQueue.length > 0 && now >= this.ppgQueue[0].displayTime) {
        const item = this.ppgQueue.shift()!;
        this.ppgHistory.push(item.value);
        this.ppgConfHistory.push(item.confidence);
        hasNewData = true;
      }

      while (
        this.respQueue.length > 0 &&
        now >= this.respQueue[0].displayTime
      ) {
        const item = this.respQueue.shift()!;
        this.respHistory.push(item.value);
        this.respConfHistory.push(item.confidence);
        hasNewData = true;
      }

      if (hasNewData) {
        const maxPoints = Math.round(this.windowSize * this.fps);

        while (this.ppgHistory.length > maxPoints) {
          this.ppgHistory.shift();
        }
        while (this.ppgConfHistory.length > maxPoints) {
          this.ppgConfHistory.shift();
        }

        while (this.respHistory.length > maxPoints) {
          this.respHistory.shift();
        }
        while (this.respConfHistory.length > maxPoints) {
          this.respConfHistory.shift();
        }

        this.onUpdate(
          this.ppgHistory,
          this.ppgConfHistory,
          this.respHistory,
          this.respConfHistory
        );
      }

      this.playbackLoopId = requestAnimationFrame(loop);
    };
    this.playbackLoopId = requestAnimationFrame(loop);
  }

  public stop() {
    if (this.playbackLoopId !== null) {
      cancelAnimationFrame(this.playbackLoopId);
      this.playbackLoopId = null;
    }
  }

  public reset() {
    this.stop();
    this.ppgQueue = [];
    this.respQueue = [];
    this.ppgHistory = [];
    this.ppgConfHistory = [];
    this.respHistory = [];
    this.respConfHistory = [];
    this.timeAnchor = null;
  }
}
