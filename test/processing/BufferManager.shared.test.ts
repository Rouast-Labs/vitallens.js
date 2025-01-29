import { BufferManager } from '../../src/processing/BufferManager';
import { MethodConfig, ROI } from '../../src/types/core';
import { Frame } from '../../src/processing/Frame';
import { FrameBuffer } from '../../src/processing/FrameBuffer';
import { RGBBuffer } from '../../src/processing/RGBBuffer';

jest.mock('../../src/processing/FrameBuffer', () => {
  return {
    FrameBuffer: jest.fn().mockImplementation(() => ({
      add: jest.fn(),
      isReady: jest.fn().mockReturnValue(false),
      isReadyState: jest.fn().mockReturnValue(false),
      consume: jest.fn().mockReturnValue([]),
      clear: jest.fn(), // Mock the clear method
    })),
  };
});
jest.mock('../../src/processing/RGBBuffer', () => {
  return {
    RGBBuffer: jest.fn().mockImplementation(() => ({
      add: jest.fn(),
      isReady: jest.fn().mockReturnValue(false),
      isReadyState: jest.fn().mockReturnValue(false),
      consume: jest.fn().mockReturnValue([]),
      clear: jest.fn(), // Mock the clear method
    })),
  };
});

const mockROI: ROI = { x0: 0, y0: 0, x1: 100, y1: 100 };
const mockMethodConfigVitalLens: MethodConfig = {
  method: 'vitallens',
  inputSize: 40,
  fpsTarget: 30,
  roiMethod: 'face',
  minWindowLength: 5,
  maxWindowLength: 10,
  requiresState: false,
};
const mockMethodConfigPOS: MethodConfig = {
  method: 'pos',
  inputSize: 40,
  fpsTarget: 30,
  roiMethod: 'face',
  minWindowLength: 5,
  maxWindowLength: 10,
  requiresState: false,
};
const mockTimestamp = Date.now();

const createMockFrame = (): Frame => {
  const rawData = new Uint8Array([1, 2, 3]).buffer;
  return new Frame(rawData, [1, 3], 'int32', [mockTimestamp]);
};

describe('BufferManager', () => {
  let bufferManager: BufferManager;

  beforeEach(() => {
    bufferManager = new BufferManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addBuffer', () => {
    it('should add a FrameBuffer for method vitallens', () => {
      bufferManager.addBuffer(mockROI, mockMethodConfigVitalLens, mockTimestamp);
      expect(FrameBuffer).toHaveBeenCalledWith(mockROI, mockMethodConfigVitalLens);
    });

    it('should add an RGBBuffer for other methods', () => {
      bufferManager.addBuffer(mockROI, mockMethodConfigPOS, mockTimestamp);
      expect(RGBBuffer).toHaveBeenCalledWith(mockROI, mockMethodConfigPOS);
    });

    it('should not add a buffer if one with the same ID already exists', () => {
      bufferManager.addBuffer(mockROI, mockMethodConfigVitalLens, mockTimestamp);
      bufferManager.addBuffer(mockROI, mockMethodConfigVitalLens, mockTimestamp);
      expect(FrameBuffer).toHaveBeenCalledTimes(1);
    });
  });

  describe('isReady', () => {
    it('should return true if a buffer is ready', () => {
      const mockBuffer = { isReady: jest.fn().mockReturnValue(true) };
      bufferManager['buffers'].set('id', { buffer: mockBuffer as any, createdAt: mockTimestamp });

      expect(bufferManager.isReady()).toBe(true);
    });

    it('should return false if no buffer is ready', () => {
      expect(bufferManager.isReady()).toBe(false);
    });
  });

  describe('getReadyBuffer', () => {
    it('should return the most recent ready buffer', () => {
      const mockBuffer1 = {
        isReady: jest.fn().mockReturnValue(true),
        isReadyState: jest.fn().mockReturnValue(false),
        consume: jest.fn(),
        clear: jest.fn(),
      };
      const mockBuffer2 = {
        isReady: jest.fn().mockReturnValue(false),
        isReadyState: jest.fn().mockReturnValue(false),
        consume: jest.fn(),
        clear: jest.fn(),
      };

      bufferManager['buffers'].set('id1', { buffer: mockBuffer1 as any, createdAt: mockTimestamp - 1000 });
      bufferManager['buffers'].set('id2', { buffer: mockBuffer2 as any, createdAt: mockTimestamp });

      const result = bufferManager['getReadyBuffer']();
      expect(result).toBe(mockBuffer1);
    });
  });

  describe('add', () => {
    it('should add a frame to all active buffers', async () => {
      const mockBuffer = { add: jest.fn() };
      const rawData = new Int32Array([1, 2, 3]).buffer;
      const frame = new Frame(rawData, [1, 1, 3], 'int32', [1000]);
      
      bufferManager['buffers'].set('id1', { buffer: mockBuffer as any, createdAt: mockTimestamp });
      bufferManager['buffers'].set('id2', { buffer: mockBuffer as any, createdAt: mockTimestamp });

      await bufferManager.add(frame);

      expect(mockBuffer.add).toHaveBeenCalledTimes(2);
    });
  });

  describe('consume', () => {
    it('should consume frames from the most recent ready buffer', () => {
      const mockBuffer = {
        isReady: jest.fn().mockReturnValue(true),
        consume: jest.fn().mockReturnValue(['frame1', 'frame2']),
      };
      bufferManager['buffers'].set('id', { buffer: mockBuffer as any, createdAt: mockTimestamp });

      const frames = bufferManager.consume();
      expect(frames).toEqual(['frame1', 'frame2']);
      expect(mockBuffer.consume).toHaveBeenCalled();
    });

    it('should return an empty array if no buffer is ready', () => {
      expect(bufferManager.consume()).toEqual([]);
    });
  });

  describe('cleanupBuffers', () => {
    it('should remove buffers older than the given timestamp', () => {
      const mockBuffer1 = { clear: jest.fn() };
      const mockBuffer2 = { clear: jest.fn() };

      bufferManager['buffers'].set('id1', { buffer: mockBuffer1 as any, createdAt: mockTimestamp - 1000 });
      bufferManager['buffers'].set('id2', { buffer: mockBuffer2 as any, createdAt: mockTimestamp });

      bufferManager['cleanupBuffers'](mockTimestamp);

      expect(mockBuffer1.clear).toHaveBeenCalled();
      expect(bufferManager['buffers'].size).toBe(1);
      expect(bufferManager['buffers'].has('id2')).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should clear all buffers and reset state', () => {
      const mockBuffer = { clear: jest.fn() };
      bufferManager['buffers'].set('id', { buffer: mockBuffer as any, createdAt: mockTimestamp });

      bufferManager.cleanup();

      expect(mockBuffer.clear).toHaveBeenCalled();
      expect(bufferManager['buffers'].size).toBe(0);
      expect(bufferManager.getState()).toBeNull();
    });
  });

  describe('setState and getState', () => {
    it('should set and get the state correctly', () => {
      const state = new Float32Array([1, 2, 3]);
      bufferManager.setState(state);

      expect(bufferManager.getState()).toEqual(state);
    });

    it('should reset state when resetState is called', () => {
      const state = new Float32Array([1, 2, 3]);
      bufferManager.setState(state);

      bufferManager.resetState();
      expect(bufferManager.getState()).toBeNull();
    });
  });
});
