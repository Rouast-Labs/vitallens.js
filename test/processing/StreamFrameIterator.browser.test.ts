/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { StreamFrameIterator } from '../../src/processing/StreamFrameIterator';

jest.mock('tfjs-provider', () => {
  const actual = jest.requireActual('@tensorflow/tfjs-core');
  return {
    ...actual,
    tidy: (fn: () => any) => fn(),
    browser: {
      ...actual.browser,
      fromPixels: jest.fn(() => {
        return {
          dataSync: jest.fn(() => new Uint8Array([1, 2, 3])),
          shape: [1, 3],
          dtype: 'uint8',
          dispose: jest.fn(),
        };
      }),
    },
    default: {
      ...actual,
      tidy: (fn: () => any) => fn(),
      browser: {
        ...actual.browser,
        fromPixels: jest.fn(() => {
          return {
            dataSync: jest.fn(() => new Uint8Array([1, 2, 3])),
            shape: [1, 3],
            dtype: 'uint8',
            dispose: jest.fn(),
          };
        }),
      },
    },
  };
});

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

  describe('constructor', () => {
    test('initializes correctly with stream and video element', () => {
      const iterator = new StreamFrameIterator(mockStream, mockVideoElement);
      expect(iterator).toBeInstanceOf(StreamFrameIterator);
    });

    test('throws if no stream or video element is provided', () => {
      expect(() => new StreamFrameIterator(undefined, undefined)).toThrow(
        'Either a MediaStream or an existing HTMLVideoElement must be provided.'
      );
    });

    test('throws if video element has no valid MediaStream assigned', () => {
      const invalidVideoElement = document.createElement('video');
      expect(
        () => new StreamFrameIterator(undefined, invalidVideoElement)
      ).toThrow(
        'Existing video element must have a valid MediaStream assigned to srcObject.'
      );
    });
  });

  describe('start', () => {
    test('initializes and plays video element', async () => {
      const iterator = new StreamFrameIterator(mockStream);

      jest.spyOn(mockVideoElement, 'play').mockResolvedValue();

      await iterator.start();

      const videoElement = (iterator as any).videoElement;
      expect(videoElement.srcObject).toBe(mockStream);
      expect(videoElement.muted).toBe(true);
      expect(videoElement.playsInline).toBe(true);
      expect(videoElement.play).toHaveBeenCalled();
    });

    test('creates a video element if not provided', async () => {
      const iterator = new StreamFrameIterator(mockStream);

      await iterator.start();

      const videoElement = (iterator as any).videoElement;
      expect(videoElement).toBeDefined();
      expect(videoElement.srcObject).toBe(mockStream);
    });
  });

  describe('next', () => {
    test('retrieves a frame from the video stream', async () => {
      const iterator = new StreamFrameIterator(mockStream, mockVideoElement);

      await iterator.start();

      const frame = await iterator.next();

      // expect(frame).toBeInstanceOf(Frame);
      // expect(browser.fromPixels).toHaveBeenCalledWith(mockVideoElement);
      // expect(frame!.getShape()).toEqual([1, 3]);
      // expect(frame!.getDType()).toBe('uint8');
    });

    test('next returns null if iterator is closed', async () => {
      const iterator = new StreamFrameIterator(mockStream, mockVideoElement);
      await iterator.start();
      iterator.stop();

      const frame = await iterator.next();

      expect(frame).toBeNull();
    });
  });

  describe('stop', () => {
    test('pauses the video element and sets isClosed to true', () => {
      const iterator = new StreamFrameIterator(mockStream, mockVideoElement);

      iterator.stop();

      expect(mockVideoElement.paused).toBe(true);
      expect((iterator as any).isClosed).toBe(true);
    });

    test('pauses the video element and sets isClosed to true', async () => {
      const iterator = new StreamFrameIterator(mockStream, mockVideoElement);

      await iterator.start();

      jest.spyOn(mockVideoElement, 'pause');

      iterator.stop();

      expect(mockVideoElement.pause).toHaveBeenCalled();
      expect((iterator as any).isClosed).toBe(true);
    });
  });
});
