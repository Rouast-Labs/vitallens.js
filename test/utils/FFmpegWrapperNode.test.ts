import path from 'path';
import fs from 'fs';
import FFmpegWrapper from '../../src/utils/FFmpegWrapper';

describe('FFmpegWrapper (Node.js Integration)', () => {
  let wrapper: FFmpegWrapper;

  beforeAll(async () => {
    wrapper = new FFmpegWrapper();
    await wrapper.init();
  });

  it('should process a real video file in Node.js', async () => {
    const inputPath = path.resolve(__dirname, '../../examples/sample_video_1.mp4');
    const outputPath = path.resolve(__dirname, '../../examples/output.rgb');
    
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Sample video not found: ${inputPath}`);
    }

    const options = {
      crop: { x: 0, y: 0, width: 100, height: 100 },
      scale: { width: 40, height: 40 },
      pixelFormat: 'rgb24',
    };

    const buffer = await wrapper.readVideo(inputPath, options);

    expect(buffer).toBeDefined();
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    // Optional: Write output for manual inspection (not necessary for tests)
    fs.writeFileSync(outputPath, buffer);
  });
});
