import { BufferManager } from '../../src/processing/BufferManager';
import { ROI } from '../../src/types/core';
import { Frame } from '../../src/processing/Frame';
import { FrameBuffer } from '../../src/processing/FrameBuffer';
import { RGBBuffer } from '../../src/processing/RGBBuffer';
import { MethodConfig } from '../../src/config/methodsConfig';

jest.mock('../../src/processing/FrameBuffer');
jest.mock('../../src/processing/RGBBuffer');

const mockROI: ROI = { x: 0, y: 0, width: 100, height: 100 };
const mockMethodConfigVitalLens: MethodConfig = { method: 'vitallens', inputSize: 40, fpsTarget: 30, roiMethod: 'face', minWindowLength: 5, maxWindowLength: 10, windowOverlap: 2, requiresState: false };
const mockMethodConfigPOS: MethodConfig = { method: 'pos', inputSize: 40, fpsTarget: 30, roiMethod: 'face', minWindowLength: 5, maxWindowLength: 10, windowOverlap: 2, requiresState: false };
const mockTimestamp = Date.now();

const createMockFrame = (): Frame => {
  return {
    retain: jest.fn(),
    release: jest.fn(),
  } as unknown as Frame;
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

  describe('consume', () => {
    it('should consume frames from the most recent ready buffer', () => {
      const mockBuffer = { isReady: jest.fn().mockReturnValue(true), consume: jest.fn().mockReturnValue(['frame1', 'frame2']) };
      bufferManager['buffers'].set('id', { buffer: mockBuffer as any, createdAt: mockTimestamp });

      const frames = bufferManager.consume();
      expect(frames).toEqual(['frame1', 'frame2']);
      expect(mockBuffer.consume).toHaveBeenCalled();
    });

    it('should return an empty array if no buffer is ready', () => {
      expect(bufferManager.consume()).toEqual([]);
    });
  });

  describe('add', () => {
    it('should add a frame to all active buffers', async () => {
      const mockFrame = createMockFrame();
      const mockBuffer = { add: jest.fn() };
      bufferManager['buffers'].set('id1', { buffer: mockBuffer as any, createdAt: mockTimestamp });
      bufferManager['buffers'].set('id2', { buffer: mockBuffer as any, createdAt: mockTimestamp });

      await bufferManager.add(mockFrame, mockTimestamp);

      expect(mockFrame.retain).toHaveBeenCalled();
      expect(mockFrame.release).toHaveBeenCalled();
      expect(mockBuffer.add).toHaveBeenCalledTimes(2);
      expect(mockBuffer.add).toHaveBeenCalledWith(mockFrame, mockTimestamp);
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
      const state = { key: 'value' };
      bufferManager.setState(state);

      expect(bufferManager.getState()).toEqual(state);
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
});
