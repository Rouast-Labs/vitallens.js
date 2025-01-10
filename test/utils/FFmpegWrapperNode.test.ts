import FFmpegWrapper from '../../src/utils/FFmpegWrapper.node';

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

jest.mock('fs', () => ({
  readFileSync: jest.fn((path: string) => {
    if (path.endsWith('output.rgb')) {
      return Buffer.from([1, 2, 3]); // Simulate file content
    }
    throw new Error(`ENOENT: no such file or directory, open '${path}'`);
  }),
  unlinkSync: jest.fn((path: string) => {
    if (!path.endsWith('output.rgb')) {
      throw new Error(`ENOENT: no such file or directory, unlink '${path}'`);
    }
  }),
}));

describe('FFmpegWrapper (Node.js)', () => {
  let wrapper: FFmpegWrapper;

  beforeEach(() => {
    wrapper = new FFmpegWrapper();
  });

  it('should initialize correctly', async () => {
    const initSpy = jest.spyOn(wrapper, 'init');
    await wrapper.init();
    expect(initSpy).toHaveBeenCalled();
  });

  it('should process video using fluent-ffmpeg', async () => {
    const video = await wrapper.readVideo('test.mp4', {
      crop: { x: 0, y: 0, width: 100, height: 100 },
      pixelFormat: 'rgb24',
    });
    expect(video).toBeDefined();
    expect(video).toBeInstanceOf(Buffer);
  });
});
