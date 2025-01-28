import path from 'path';
import fs from 'fs';
import FFmpegWrapper from '../../src/utils/FFmpegWrapper.node';

describe('FFmpegWrapper (Node)', () => {
  let wrapper: FFmpegWrapper;
  const SAMPLE_VIDEO = path.resolve(__dirname, '../../examples/sample_video_1.mp4');

  beforeAll(async () => {
    wrapper = new FFmpegWrapper();
    await wrapper.init();
  });

  it('should process a real video file in Node.js', async () => {
    // const outputPath = path.resolve(__dirname, '../../examples/output.rgb');
    
    if (!fs.existsSync(SAMPLE_VIDEO)) {
      throw new Error(`Sample video not found: ${SAMPLE_VIDEO}`);
    }

    const options = {
      crop: { x0: 0, y0: 0, x1: 100, y1: 100 },
      scale: { width: 40, height: 40 },
      pixelFormat: 'rgb24',
    };

    const buffer = await wrapper.readVideo(SAMPLE_VIDEO, options);

    expect(buffer).toBeDefined();
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    // Optional: Write output for manual inspection (not necessary for tests)
    // fs.writeFileSync(outputPath, buffer);
  });
});
