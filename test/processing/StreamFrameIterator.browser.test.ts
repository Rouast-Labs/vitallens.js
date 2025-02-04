/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { StreamFrameIterator } from '../../src/processing/StreamFrameIterator';
import { Frame } from '../../src/processing/Frame';
import { browser } from '@tensorflow/tfjs-core';

jest.mock('@tensorflow/tfjs-core', () => ({
  ...jest.requireActual('@tensorflow/tfjs-core'),
  browser: {
    fromPixels: jest.fn(() => {
      const mockTypedArray = new Uint8Array([1, 2, 3]);
      const mockTensor = {
        dataSync: jest.fn(() => mockTypedArray),
        shape: [1, 3],
        dtype: 'uint8',
        dispose: jest.fn(),
      };
      return mockTensor;
    }),
  },
}));

// Mock MediaStream globally
global.MediaStream = class MediaStream {
  // Add any required mock implementation for your tests
} as any;

describe('StreamFrameIterator', () => {
  let mockStream: MediaStream;
  let mockVideoElement: HTMLVideoElement;

  beforeEach(() => {
    mockStream = new MediaStream();
    mockVideoElement = document.createElement('video');
    mockVideoElement.srcObject = mockStream;
    Object.defineProperty(mockVideoElement, 'videoWidth', { get: () => 640 });
    Object.defineProperty(mockVideoElement, 'videoHeight', { get: () => 480 });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('constructor initializes correctly with stream and video element', () => {
    const iterator = new StreamFrameIterator(mockStream, mockVideoElement);
    expect(iterator).toBeInstanceOf(StreamFrameIterator);
  });

  test('constructor throws if no stream or video element is provided', () => {
    expect(() => new StreamFrameIterator(undefined, undefined)).toThrow(
      'Either a MediaStream or an existing HTMLVideoElement must be provided.'
    );
  });

  test('constructor throws if video element has no valid MediaStream assigned', () => {
    const invalidVideoElement = document.createElement('video');
    expect(
      () => new StreamFrameIterator(undefined, invalidVideoElement)
    ).toThrow(
      'Existing video element must have a valid MediaStream assigned to srcObject.'
    );
  });

  test('start initializes and plays video element', async () => {
    const iterator = new StreamFrameIterator(mockStream);

    jest.spyOn(mockVideoElement, 'play').mockResolvedValue();

    await iterator.start();

    const videoElement = (iterator as any).videoElement;
    expect(videoElement.srcObject).toBe(mockStream);
    expect(videoElement.muted).toBe(true);
    expect(videoElement.playsInline).toBe(true);
    expect(videoElement.play).toHaveBeenCalled();
  });

  test('start creates a video element if not provided', async () => {
    const iterator = new StreamFrameIterator(mockStream);

    await iterator.start();

    const videoElement = (iterator as any).videoElement;
    expect(videoElement).toBeDefined();
    expect(videoElement.srcObject).toBe(mockStream);
  });

  test('next retrieves a frame from the video stream', async () => {
    const iterator = new StreamFrameIterator(mockStream, mockVideoElement);

    await iterator.start();

    const frame = await iterator.next();

    expect(frame).toBeInstanceOf(Frame);
    expect(browser.fromPixels).toHaveBeenCalledWith(mockVideoElement);
    expect(frame!.getShape()).toEqual([1, 3]);
    expect(frame!.getDType()).toBe('uint8');
  });

  test('next returns null if iterator is closed', async () => {
    const iterator = new StreamFrameIterator(mockStream, mockVideoElement);
    await iterator.start();
    iterator.stop();

    const frame = await iterator.next();

    expect(frame).toBeNull();
  });

  test('stop pauses the video element and sets isClosed to true', () => {
    const iterator = new StreamFrameIterator(mockStream, mockVideoElement);

    iterator.stop();

    expect(mockVideoElement.paused).toBe(true);
    expect((iterator as any).isClosed).toBe(true);
  });

  test('stop pauses the video element and sets isClosed to true', async () => {
    const iterator = new StreamFrameIterator(mockStream, mockVideoElement);

    await iterator.start();

    jest.spyOn(mockVideoElement, 'pause');

    iterator.stop();

    expect(mockVideoElement.pause).toHaveBeenCalled();
    expect((iterator as any).isClosed).toBe(true);
  });
});
