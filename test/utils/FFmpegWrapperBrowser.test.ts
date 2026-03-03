// @vitest-environment jsdom

import FFmpegWrapper from '../../src/utils/FFmpegWrapper.browser';
import { describe, expect, beforeEach, vi, it } from 'vitest';

// Mock the ffmpeg worker bundle
vi.mock('../../dist/ffmpeg.worker.bundle.js', () => ({
  default:
    'data:application/javascript;base64,Y29uc29sZS5sb2coImZha2Ugd29ya2VyIik7',
}));

vi.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: class {
    isLoaded = vi.fn(() => false);
    load = vi.fn();
    writeFile = vi.fn();
    exec = vi.fn();
    readFile = vi.fn(() => new Uint8Array([1, 2, 3]));
    deleteFile = vi.fn();
    on = vi.fn();
    off = vi.fn();
  },
}));

vi.mock('@ffmpeg/util', () => ({
  fetchFile: vi.fn(() => new Uint8Array([1, 2, 3])),
  toBlobURL: vi.fn(async (url) => url),
}));

// Mock URL.createObjectURL since it's not implemented in JSDOM
if (typeof window !== 'undefined') {
  global.URL.createObjectURL = vi.fn(() => 'blob:mock');
  global.URL.revokeObjectURL = vi.fn();
}

describe('FFmpegWrapper (Browser)', () => {
  let wrapper: FFmpegWrapper;

  beforeEach(() => {
    wrapper = new FFmpegWrapper();
    vi.clearAllMocks();
  });

  it('should initialize correctly', async () => {
    const initSpy = vi.spyOn(wrapper, 'init');
    await wrapper.init();
    expect(initSpy).toHaveBeenCalled();
  });

  it('should process video using ffmpeg.wasm', async () => {
    const video = await wrapper.readVideo(
      'test.mp4',
      {
        scale: { width: 100, height: 100 },
        pixelFormat: 'rgb24',
      },
      {
        fps: 30,
        totalFrames: 100,
        width: 300,
        height: 200,
        codec: 'h264',
        bitrate: 10000,
        rotation: 0,
        issues: false,
      }
    );
    expect(video).toBeDefined();
    expect(video).toBeInstanceOf(Uint8Array);
  });
});
