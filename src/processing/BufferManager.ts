import { MethodConfig, ROI } from '../types/core';
import { Frame } from './Frame';
import { Buffer } from './Buffer';
import { FrameBuffer } from './FrameBuffer';
import { RGBBuffer } from './RGBBuffer';
import { getCore } from '../core/wasmProvider';

let core: any = null;
getCore().then((c) => (core = c));

export class BufferManager {
  private buffers: Map<
    string,
    { buffer: Buffer; createdAt: number; lastSeen: number; roi: ROI }
  >;
  private state: Float32Array | null = null;
  private planner: any = null;

  constructor() {
    this.buffers = new Map();
  }

  private ensurePlanner(methodConfig: MethodConfig) {
    if (!this.planner && core) {
      const sessionConfig = {
        model_name: methodConfig.method,
        supported_vitals: methodConfig.supportedVitals,
        fps_target: methodConfig.fpsTarget,
        input_size: methodConfig.inputSize || 40,
        n_inputs: methodConfig.minWindowLengthState || 16,
        roi_method: methodConfig.roiMethod,
      };
      const bufferConfig = core.computeBufferConfig(sessionConfig);
      this.planner = new core.BufferPlanner(bufferConfig);
    }
  }

  processTarget(
    targetRoi: ROI,
    timestamp: number,
    methodConfig: MethodConfig
  ): ROI | null {
    this.ensurePlanner(methodConfig);
    if (!this.planner) return null;

    const activeBuffers = Array.from(this.buffers.entries()).map(
      ([id, data]) => ({
        id,
        roi: {
          x: data.roi.x0,
          y: data.roi.y0,
          width: data.roi.x1 - data.roi.x0,
          height: data.roi.y1 - data.roi.y0,
        },
        count: data.buffer.size(),
        created_at: data.createdAt,
        last_seen: data.lastSeen,
      })
    );

    const rect = {
      x: targetRoi.x0,
      y: targetRoi.y0,
      width: targetRoi.x1 - targetRoi.x0,
      height: targetRoi.y1 - targetRoi.y0,
    };

    const action = this.planner.evaluateTarget(rect, timestamp, activeBuffers);

    if (action.action === 'Create') {
      const newId = crypto.randomUUID();
      let newBuffer: Buffer;
      if (methodConfig.method.startsWith('vitallens')) {
        newBuffer = new FrameBuffer(targetRoi, methodConfig);
      } else {
        newBuffer = new RGBBuffer(targetRoi, methodConfig);
      }
      this.buffers.set(newId, {
        buffer: newBuffer,
        createdAt: timestamp,
        lastSeen: timestamp,
        roi: targetRoi,
      });
      return targetRoi;
    } else if (action.action === 'KeepAlive') {
      const matchedId = action.matched_id;
      if (matchedId && this.buffers.has(matchedId)) {
        this.buffers.get(matchedId)!.lastSeen = timestamp;
        return this.buffers.get(matchedId)!.roi;
      }
    }
    return null;
  }

  poll(
    currentTime: number,
    mode: 'Stream' | 'File',
    flush: boolean = false
  ): any {
    if (!this.planner) return null;

    const activeBuffers = Array.from(this.buffers.entries()).map(
      ([id, data]) => ({
        id,
        roi: {
          x: data.roi.x0,
          y: data.roi.y0,
          width: data.roi.x1 - data.roi.x0,
          height: data.roi.y1 - data.roi.y0,
        },
        count: data.buffer.size(),
        created_at: data.createdAt,
        last_seen: data.lastSeen,
      })
    );

    const hasState = this.state !== null;
    const plan = this.planner.poll(
      activeBuffers,
      currentTime,
      mode,
      hasState,
      flush
    );

    if (plan.buffers_to_drop) {
      for (const dropId of plan.buffers_to_drop) {
        this.buffers.get(dropId)?.buffer.clear();
        this.buffers.delete(dropId);
      }
    }

    return plan.command;
  }

  async add(frame: Frame, overrideRoi?: ROI): Promise<void> {
    for (const { buffer } of this.buffers.values()) {
      await buffer.add(frame, overrideRoi);
    }
  }

  async consumeCommand(command: any): Promise<Frame | null> {
    const target = this.buffers.get(command.buffer_id);
    if (!target) return null;
    return target.buffer.consume(command.take_count, command.keep_count);
  }

  isEmpty(): boolean {
    return this.buffers.size === 0;
  }

  cleanup(): void {
    for (const { buffer } of this.buffers.values()) {
      buffer.clear();
    }
    this.buffers.clear();
    this.state = null;
  }

  setState(state: Float32Array): void {
    this.state = state;
  }

  resetState(): void {
    this.state = null;
  }

  getState(): Float32Array | null {
    return this.state;
  }
}
