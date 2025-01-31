import path from 'path';
import fs from 'fs';
import FFmpegWrapper from '../../src/utils/FFmpegWrapper.node';
import { VideoProbeResult, VideoProcessingOptions } from '../../src/types';

describe('FFmpegWrapper (Node)', () => {
  let wrapper: FFmpegWrapper;
  const SAMPLE_VIDEO = path.resolve(__dirname, '../../examples/sample_video_1.mp4');

  beforeAll(async () => {
    wrapper = new FFmpegWrapper();
    await wrapper.init();
  });

  it('should probe a real video file', async () => {    
    if (!fs.existsSync(SAMPLE_VIDEO)) {
      throw new Error(`Sample video not found: ${SAMPLE_VIDEO}`);
    }

    const probeInfo = await wrapper.probeVideo(SAMPLE_VIDEO);

    // Validate probeInfo structure
    expect(probeInfo).toBeDefined();
    expect(probeInfo).toHaveProperty('fps');
    expect(probeInfo).toHaveProperty('totalFrames');
    expect(probeInfo).toHaveProperty('width');
    expect(probeInfo).toHaveProperty('height');
    expect(probeInfo).toHaveProperty('codec');
    expect(probeInfo).toHaveProperty('bitrate');
    expect(probeInfo).toHaveProperty('rotation');
    expect(probeInfo).toHaveProperty('issues');

    // Validate expected values (ensure they are reasonable)
    expect(probeInfo.fps).toBeGreaterThan(0);
    expect(probeInfo.totalFrames).toBeGreaterThan(0);
    expect(probeInfo.width).toBeGreaterThan(0);
    expect(probeInfo.height).toBeGreaterThan(0);
    expect(probeInfo.codec).toBeTruthy(); // Ensures it's a valid string
    expect(probeInfo.bitrate).toBeGreaterThan(0);
    expect(probeInfo.rotation).toBeGreaterThanOrEqual(0);
    expect(probeInfo.issues).toBe(false);
  }, 10000);

  it('should process a real video file', async () => {    
    if (!fs.existsSync(SAMPLE_VIDEO)) {
      throw new Error(`Sample video not found: ${SAMPLE_VIDEO}`);
    }

    const options: VideoProcessingOptions = {
      crop: { x0: 0, y0: 0, x1: 100, y1: 100 },
      scale: { width: 40, height: 40 },
      pixelFormat: 'rgb24',
    };

    const probeInfo: VideoProbeResult = {
      fps: 30,
      totalFrames: 354,
      width: 640,
      height: 480,
      codec: 'h264',
      bitrate: 13051,
      rotation: 0,
      issues: false
    }

    const buffer = await wrapper.readVideo(SAMPLE_VIDEO, options, probeInfo);

    expect(buffer).toBeDefined();
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
