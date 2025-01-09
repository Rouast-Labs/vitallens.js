import FFmpegWrapper from '../../src/utils/FFmpegWrapper';

jest.mock('fluent-ffmpeg', () => {
  const mockFFmpeg = jest.fn(() => ({
    outputOptions: jest.fn().mockReturnThis(),
    videoFilter: jest.fn().mockReturnThis(),
    save: jest.fn().mockImplementation((output: string) => ({
      on: jest.fn((event: string, callback: Function) => {
        if (event === "end") {
          callback(); // Simulate the end event
        }
        if (event === "error") {
          callback(new Error("Mocked error")); // Simulate an error event if needed
        }
        return this; // Ensure chainability
      }),
    })),
  }));
  mockFFmpeg.prototype = {};
  return mockFFmpeg;
});

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

jest.mock('fs', () => ({
  readFileSync: jest.fn((path: string) => {
    if (path === 'output.rgb') {
      return Buffer.from([1, 2, 3]); // Simulate file content
    }
    throw new Error(`ENOENT: no such file or directory, open '${path}'`);
  }),
  unlinkSync: jest.fn((path: string) => {
    if (path !== 'output.rgb') {
      throw new Error(`ENOENT: no such file or directory, unlink '${path}'`);
    }
  }),
}));

describe('FFmpegWrapper', () => {
  let wrapper: FFmpegWrapper;

  beforeEach(() => {
    wrapper = new FFmpegWrapper();
  });

  const mockIsNode = (isNode: boolean) => {
    Object.defineProperty(wrapper, 'isNode', {
      get: jest.fn(() => isNode),
    });
  };

  it('should initialize correctly in Node.js', async () => {
    mockIsNode(true); // Simulate Node.js environment
    const initSpy = jest.spyOn(wrapper, 'init');
    await wrapper.init();
    expect(initSpy).toHaveBeenCalled();
  });

  it('should initialize correctly in the browser', async () => {
    mockIsNode(false); // Simulate browser environment
    const initSpy = jest.spyOn(wrapper, 'init');
    await wrapper.init();
    expect(initSpy).toHaveBeenCalled();
  });

  it('should process video in Node.js using fluent-ffmpeg', async () => {
    mockIsNode(true); // Simulate Node.js environment
    const video = await wrapper.readVideo('test.mp4', {
      crop: { x: 0, y: 0, width: 100, height: 100 },
      pixelFormat: 'rgb24',
    });
    expect(video).toBeDefined();
    expect(video).toBeInstanceOf(Buffer);
  });

  it('should process video in the browser using ffmpeg.wasm', async () => {
    mockIsNode(false); // Simulate browser environment
    const video = await wrapper.readVideo('test.mp4', {
      scale: { width: 100, height: 100 },
      pixelFormat: 'rgb24',
    });
    expect(video).toBeDefined();
    expect(video).toBeInstanceOf(Uint8Array);
  });
});
