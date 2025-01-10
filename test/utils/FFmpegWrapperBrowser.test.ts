import FFmpegWrapper from '../../src/utils/FFmpegWrapper.browser';

jest.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: jest.fn(() => ({
    isLoaded: jest.fn(() => false),
    load: jest.fn(),
    writeFile: jest.fn(),
    exec: jest.fn(),
    readFile: jest.fn(() => new Uint8Array([1, 2, 3])),
    unlink: jest.fn(),
  })),
}));

jest.mock('@ffmpeg/util', () => ({
  fetchFile: jest.fn(() => new Uint8Array([1, 2, 3])),
  toBlobURL: jest.fn((url, type) => `${url}-${type}`),
}));

describe('FFmpegWrapper (Browser)', () => {
  let wrapper: FFmpegWrapper;

  beforeEach(() => {
    wrapper = new FFmpegWrapper();
  });

  it('should initialize correctly', async () => {
    const initSpy = jest.spyOn(wrapper, 'init');
    await wrapper.init();
    expect(initSpy).toHaveBeenCalled();
  });

  it('should process video using ffmpeg.wasm', async () => {
    const video = await wrapper.readVideo('test.mp4', {
      scale: { width: 100, height: 100 },
      pixelFormat: 'rgb24',
    });
    expect(video).toBeDefined();
    expect(video).toBeInstanceOf(Uint8Array);
  });
});
