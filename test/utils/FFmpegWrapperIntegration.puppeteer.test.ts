/// <reference types="jest-puppeteer" />

describe('FFmpegWrapper (Browser)', () => {

  beforeAll(async () => {
    // Listeners for console logs:
    page.on('console', (msg) => {
      console.log(`BROWSER LOG: ${msg.type().toUpperCase()}: ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      console.error(`PAGE ERROR: ${err}`);
    });
  });

  const SAMPLE_VIDEO_URL = 'http://localhost:8080/sample_video_1.mp4';

  beforeEach(async () => {
    await page.setBypassCSP(true);
    await page.goto(`http://localhost:8080`);
    
    // Inject FFmpegWrapper script
    await page.addScriptTag({
      url: 'http://localhost:8080/utils/FFmpegWrapper.browser.umd.js',
      type: 'module',
    });
  });

  it('should probe a real video file in the browser', async () => {
    const probeInfo = await page.evaluate(async (videoUrl) => {
      try {
        const wrapper = new (window as any).FFmpegWrapper();
        // Return the metadata directly
        return await wrapper.probeVideo(videoUrl);
      } catch (e: any) {
        throw new Error(`Browser code failed: ${e.message}`);
      }
    }, SAMPLE_VIDEO_URL);
  
    // Now perform assertions on probeInfo.
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
    expect(probeInfo.fps).toBeCloseTo(30.1);
    expect(probeInfo.totalFrames).toEqual(354);
    expect(probeInfo.width).toEqual(640);
    expect(probeInfo.height).toEqual(480);
    expect(probeInfo.codec).toBeTruthy();
    expect(probeInfo.bitrate).toBeGreaterThan(0);
    expect(probeInfo.rotation).toEqual(0);
    expect(probeInfo.issues).toBe(false);
  }, 20000);
  
  it('should process a real video file in the browser', async () => {
    const options = {
      crop: { x0: 0, y0: 0, x1: 100, y1: 100 },
      scale: { width: 40, height: 40 },
      pixelFormat: 'rgb24',
    };
  
    const probeInfo = {
      fps: 30.1,
      totalFrames: 354,
      width: 640,
      height: 480,
      codec: 'h264',
      bitrate: 13051,
      rotation: 0,
      issues: false,
    };
  
    const plainBuffer = await page.evaluate(async (videoUrl, options, probeInfo) => {
      try {
        const wrapper = new (window as any).FFmpegWrapper();
        const buffer = await wrapper.readVideo(videoUrl, options, probeInfo);
        // Convert the Uint8Array into a plain array for serialization.
        return Array.from(buffer);
      } catch (e: any) {
        throw new Error(`Browser code failed: ${e.message}`);
      }
    }, SAMPLE_VIDEO_URL, options, probeInfo);
  
    // Reconstruct the Uint8Array on the Node side.
    const bufferUint8 = new Uint8Array(plainBuffer as number[]);
    expect(bufferUint8).toBeDefined();
    expect(bufferUint8).toBeInstanceOf(Uint8Array);
    expect(bufferUint8.length).toEqual(354 * 40 * 40 * 3);
  }, 30000);
  
});
