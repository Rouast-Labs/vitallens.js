/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom

import { StreamFrameIterator } from '../../src/processing/StreamFrameIterator';
import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('tfjs-provider', async () => {
  const actual: any = await vi.importActual('@tensorflow/tfjs-core');
  return {
    ...actual,
    tidy: (fn: () => any) => fn(),
    browser: {
      ...actual.browser,
      fromPixels: vi.fn(() => {
        return {
          dataSync: vi.fn(() => new Uint8Array([1, 2, 3])),
          shape: [1, 3],
          dtype: 'uint8',
          dispose: vi.fn(),
        };
      }),
    },
    default: {
      ...actual,
      tidy: (fn: () => any) => fn(),
      browser: {
        ...actual.browser,
        fromPixels: vi.fn(() => {
          return {
            dataSync: vi.fn(() => new Uint8Array([1, 2, 3])),
            shape: [1, 3],
            dtype: 'uint8',
            dispose: vi.fn(),
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
    vi.clearAllMocks();
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

      vi.spyOn(mockVideoElement, 'play').mockResolvedValue();

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

  describe('requestVideoFrameCallback', () => {
    let callbacks: VideoFrameRequestCallback[];

    beforeEach(() => {
      callbacks = [];
      (mockVideoElement as any).requestVideoFrameCallback = vi.fn(
        (cb: VideoFrameRequestCallback) => callbacks.push(cb)
      );
      (mockVideoElement as any).cancelVideoFrameCallback = vi.fn();
      vi.spyOn(mockVideoElement, 'play').mockResolvedValue();
    });

    const present = (
      now: number,
      presentedFrames: number,
      extra: Partial<VideoFrameCallbackMetadata> = {}
    ) => {
      const cb = callbacks.shift()!;
      cb(now, {
        presentedFrames,
        mediaTime: now / 1000,
        ...extra,
      } as VideoFrameCallbackMetadata);
    };

    test('is frame paced and stamps frames with the capture time', async () => {
      const iterator = new StreamFrameIterator(mockStream, mockVideoElement);
      await iterator.start();
      expect(iterator.isFramePaced()).toBe(true);

      const pending = iterator.next();
      present(1040, 1, { captureTime: 1000 });
      const frame = await pending;

      expect(frame!.getTimestamp()).toEqual([1.0]);
    });

    test('falls back to media time shifted onto the performance clock', async () => {
      const iterator = new StreamFrameIterator(mockStream, mockVideoElement);
      await iterator.start();

      const first = iterator.next();
      present(5000, 1, { mediaTime: 2.0 });
      await first;
      const second = iterator.next();
      present(5050, 2, { mediaTime: 2.033 });

      expect((await second)!.getTimestamp()[0]).toBeCloseTo(5.033, 6);
    });

    test('skips frames that come sooner than the frame interval', async () => {
      const iterator = new StreamFrameIterator(mockStream, mockVideoElement);
      await iterator.start();
      iterator.setFrameInterval(1 / 30);

      // 60 fps camera: every second frame is delivered
      for (let i = 0; i < 6; i++) {
        present(1000 + i * 16.667, i + 1, { captureTime: 1000 + i * 16.667 });
      }

      expect(iterator.getFrameStats().delivered).toBe(3);
    });

    test('counts missed callbacks and overwritten frames', async () => {
      const iterator = new StreamFrameIterator(mockStream, mockVideoElement);
      await iterator.start();

      present(1000, 1, { captureTime: 1000 });
      present(1033, 2, { captureTime: 1033 });
      present(1133, 5, { captureTime: 1133 });

      expect(iterator.getFrameStats()).toEqual({
        delivered: 3,
        missed: 2,
        overwritten: 2,
      });
      expect((await iterator.next())!.getTimestamp()).toEqual([1.133]);
    });

    test('stop resolves a waiting next with null', async () => {
      const iterator = new StreamFrameIterator(mockStream, mockVideoElement);
      await iterator.start();

      const pending = iterator.next();
      iterator.stop();

      expect(await pending).toBeNull();
      expect(mockVideoElement.cancelVideoFrameCallback).toHaveBeenCalled();
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

      vi.spyOn(mockVideoElement, 'pause');

      iterator.stop();

      expect(mockVideoElement.pause).toHaveBeenCalled();
      expect((iterator as any).isClosed).toBe(true);
    });
  });
});
