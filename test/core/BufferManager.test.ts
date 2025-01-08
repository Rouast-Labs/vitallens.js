import { BufferManager } from '../../src/core/BufferManager';
import { Frame } from '../../src/types/core';

describe('BufferManager', () => {
  const mockFps = 30;
  let bufferManager: BufferManager;

  beforeEach(() => {
    bufferManager = new BufferManager(mockFps);
  });

  it('should initialize with the correct max buffer size', () => {
    expect(bufferManager.getMaxBufferSize()).toBe(mockFps * 3); // 3-second buffer
  });

  it('should add frames to the buffer', () => {
    const mockFrame: Frame = { data: 'mock-data', timestamp: 123 };

    bufferManager.addFrame(mockFrame);
    expect(bufferManager.getBuffer()).toContain(mockFrame);
  });

  it('should remove the oldest frame when the buffer exceeds the max size', () => {
    const maxBufferSize = bufferManager.getMaxBufferSize();

    for (let i = 0; i < maxBufferSize + 1; i++) {
      bufferManager.addFrame({ data: `mock-data-${i}`, timestamp: i });
    }

    const buffer = bufferManager.getBuffer();
    expect(buffer.length).toBe(maxBufferSize);
    expect(buffer[0].data).toBe('mock-data-1'); // Oldest frame removed
  });

  it('should return true when the buffer is ready', () => {
    const maxBufferSize = bufferManager.getMaxBufferSize();

    for (let i = 0; i < maxBufferSize; i++) {
      bufferManager.addFrame({ data: `mock-data-${i}`, timestamp: i });
    }

    expect(bufferManager.isReady()).toBe(true);
  });

  it('should return false when the buffer is not full', () => {
    bufferManager.addFrame({ data: 'mock-data', timestamp: 123 });
    expect(bufferManager.isReady()).toBe(false);
  });

  it('should clear the buffer', () => {
    bufferManager.addFrame({ data: 'mock-data', timestamp: 123 });
    bufferManager.clearBuffer();
    expect(bufferManager.getBuffer()).toEqual([]);
  });
});
