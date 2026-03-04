/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { BufferManager } from '../../src/processing/BufferManager';
import { MethodConfig, ROI } from '../../src/types/core';
import { Frame } from '../../src/processing/Frame';
import { FrameBuffer } from '../../src/processing/FrameBuffer';
import { RGBBuffer } from '../../src/processing/RGBBuffer';
import { getCore } from '../../src/core/wasmProvider';
import {
  describe,
  expect,
  beforeEach,
  vi,
  it,
  beforeAll,
  afterEach,
} from 'vitest';

// Mock the specific buffers
vi.mock('../../src/processing/FrameBuffer', () => {
  return {
    FrameBuffer: class {
      add = vi.fn();
      consume = vi.fn().mockResolvedValue('mock-frame');
      clear = vi.fn();
      size = vi.fn().mockReturnValue(5);
    },
  };
});

vi.mock('../../src/processing/RGBBuffer', () => {
  return {
    RGBBuffer: class {
      add = vi.fn();
      consume = vi.fn().mockResolvedValue('mock-frame');
      clear = vi.fn();
      size = vi.fn().mockReturnValue(5);
    },
  };
});

// Mock the Wasm core provider
const mockPlanner = {
  evaluateTarget: vi.fn(),
  poll: vi.fn(),
};

vi.mock('../../src/core/wasmProvider', () => {
  const mockCore = {
    computeBufferConfig: vi.fn().mockReturnValue({}),
    BufferPlanner: class {
      constructor() {
        return mockPlanner;
      }
    },
  };
  return {
    getCore: vi.fn().mockResolvedValue(mockCore),
    getCoreSync: vi.fn().mockReturnValue(mockCore),
  };
});

// Mock UUID to predict buffer keys
vi.stubGlobal('crypto', {
  randomUUID: vi.fn().mockReturnValue('mock-uuid'),
});

const mockROI: ROI = { x0: 0, y0: 0, x1: 100, y1: 100 };
const mockMethodConfigVitalLens: MethodConfig = {
  method: 'vitallens-1.0',
  inputSize: 40,
  fpsTarget: 30,
  roiMethod: 'face',
  minWindowLength: 5,
  maxWindowLength: 10,
  requiresState: false,
  bufferOffset: 1,
  supportedVitals: ['ppg_waveform', 'heart_rate'],
};
const mockMethodConfigPOS: MethodConfig = {
  method: 'pos',
  inputSize: 40,
  fpsTarget: 30,
  roiMethod: 'face',
  minWindowLength: 5,
  maxWindowLength: 10,
  requiresState: false,
  bufferOffset: 0,
  supportedVitals: ['ppg_waveform', 'heart_rate'],
};

describe('BufferManager', () => {
  let bufferManager: BufferManager;

  beforeAll(async () => {
    // Ensure Wasm core is resolved for the local variable in BufferManager.ts
    await getCore();
  });

  beforeEach(() => {
    bufferManager = new BufferManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('processTarget', () => {
    it('creates a new FrameBuffer for vitallens methods when action is Create', () => {
      mockPlanner.evaluateTarget.mockReturnValueOnce({ action: 'Create' });

      const result = bufferManager.processTarget(
        mockROI,
        1000,
        mockMethodConfigVitalLens
      );

      expect(result).toEqual(mockROI);
      expect(bufferManager.isEmpty()).toBe(false);
    });

    it('creates a new RGBBuffer for classical methods when action is Create', () => {
      mockPlanner.evaluateTarget.mockReturnValueOnce({ action: 'Create' });

      const result = bufferManager.processTarget(
        mockROI,
        1000,
        mockMethodConfigPOS
      );

      expect(result).toEqual(mockROI);
      expect(bufferManager.isEmpty()).toBe(false);
    });

    it('updates lastSeen when action is KeepAlive', () => {
      // First, create a buffer
      mockPlanner.evaluateTarget.mockReturnValueOnce({ action: 'Create' });
      bufferManager.processTarget(mockROI, 1000, mockMethodConfigVitalLens);

      // Now, keep it alive
      mockPlanner.evaluateTarget.mockReturnValueOnce({
        action: 'KeepAlive',
        matched_id: 'mock-uuid',
      });
      const result = bufferManager.processTarget(
        mockROI,
        2000,
        mockMethodConfigVitalLens
      );

      expect(result).toEqual(mockROI);
      // Access private map to check if lastSeen updated
      const internalBuffer = (bufferManager as any).buffers.get('mock-uuid');
      expect(internalBuffer.lastSeen).toBe(2000);
    });

    it('returns null when action is Ignore', () => {
      mockPlanner.evaluateTarget.mockReturnValueOnce({ action: 'Ignore' });

      const result = bufferManager.processTarget(
        mockROI,
        1000,
        mockMethodConfigVitalLens
      );

      expect(result).toBeNull();
    });
  });

  describe('poll', () => {
    it('drops stale buffers and returns the command', () => {
      // Setup a dummy buffer
      mockPlanner.evaluateTarget.mockReturnValueOnce({ action: 'Create' });
      bufferManager.processTarget(mockROI, 1000, mockMethodConfigVitalLens);
      const internalBufferMap = (bufferManager as any).buffers;
      const dummyBufferInstance = internalBufferMap.get('mock-uuid').buffer;

      const mockCommand = {
        buffer_id: 'mock-uuid',
        take_count: 5,
        keep_count: 2,
      };
      mockPlanner.poll.mockReturnValueOnce({
        command: mockCommand,
        buffers_to_drop: ['mock-uuid'], // Tell it to drop the buffer we just created
      });

      const command = bufferManager.poll(2000, 'Stream');

      expect(command).toEqual(mockCommand);
      expect(dummyBufferInstance.clear).toHaveBeenCalled(); // Dropped buffers must be cleared
      expect(bufferManager.isEmpty()).toBe(true); // Buffer was removed
    });
  });

  describe('add', () => {
    it('adds a frame to all active buffers', async () => {
      mockPlanner.evaluateTarget.mockReturnValueOnce({ action: 'Create' });
      bufferManager.processTarget(mockROI, 1000, mockMethodConfigVitalLens);

      const rawData = new Int32Array([1, 2, 3]).buffer;
      const frame = new Frame({
        rawData,
        keepTensor: false,
        shape: [1, 1, 3],
        dtype: 'int32',
        timestamp: [1000],
      });

      await bufferManager.add(frame);

      const internalBuffer = (bufferManager as any).buffers.get(
        'mock-uuid'
      ).buffer;
      expect(internalBuffer.add).toHaveBeenCalledWith(frame, undefined);
    });
  });

  describe('consumeCommand', () => {
    it('consumes frames with specific counts from the target buffer', async () => {
      mockPlanner.evaluateTarget.mockReturnValueOnce({ action: 'Create' });
      bufferManager.processTarget(mockROI, 1000, mockMethodConfigVitalLens);

      const command = { buffer_id: 'mock-uuid', take_count: 5, keep_count: 2 };
      const frame = await bufferManager.consumeCommand(command);

      const internalBuffer = (bufferManager as any).buffers.get(
        'mock-uuid'
      ).buffer;
      expect(internalBuffer.consume).toHaveBeenCalledWith(5, 2);
      expect(frame).toEqual('mock-frame');
    });

    it('returns null if the requested buffer id does not exist', async () => {
      const command = {
        buffer_id: 'non-existent',
        take_count: 5,
        keep_count: 2,
      };
      const frame = await bufferManager.consumeCommand(command);
      expect(frame).toBeNull();
    });
  });

  describe('cleanup and state management', () => {
    it('clears all buffers and resets state on cleanup', () => {
      mockPlanner.evaluateTarget.mockReturnValueOnce({ action: 'Create' });
      bufferManager.processTarget(mockROI, 1000, mockMethodConfigVitalLens);

      const internalBuffer = (bufferManager as any).buffers.get(
        'mock-uuid'
      ).buffer;
      bufferManager.setState(new Float32Array([1, 2, 3]));

      bufferManager.cleanup();

      expect(internalBuffer.clear).toHaveBeenCalled();
      expect(bufferManager.isEmpty()).toBe(true);
      expect(bufferManager.getState()).toBeNull();
    });

    it('sets and gets recurrent state correctly', () => {
      const state = new Float32Array([1, 2, 3]);
      bufferManager.setState(state);
      expect(bufferManager.getState()).toEqual(state);
    });

    it('resets recurrent state correctly', () => {
      const state = new Float32Array([1, 2, 3]);
      bufferManager.setState(state);
      bufferManager.resetState();
      expect(bufferManager.getState()).toBeNull();
    });
  });
});
