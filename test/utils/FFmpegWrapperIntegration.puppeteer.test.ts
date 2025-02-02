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

  it('initializes FFmpegWrapper in browser', async () => {
    const logs = await page.evaluate(async () => {
      const logs: string[] = [];
      logs.push('Initializing FFmpegWrapper...');
      const wrapper = new (window as any).FFmpegWrapper();
      try {
        await wrapper.init();
        logs.push('FFmpegWrapper initialized successfully');
      } catch (error) {
        logs.push(`Error during initialization: ${(error as Error).message}`);
      }
      return logs;
    });

    console.log('BROWSER LOGS:', logs.join('\n'));
    expect(logs).toContain('FFmpegWrapper initialized successfully');
  }, 10000);

  it('should probe a real video file in the browser', async () => {
    const result = await page.evaluate(async (videoUrl) => {
      const logs: string[] = [];
      try {
        logs.push("Browser script: Creating FFmpegWrapper...");
        const wrapper = new (window as any).FFmpegWrapper();
        logs.push("Browser script: wrapper created, calling probeVideo...");
  
        const metadata = await wrapper.probeVideo(videoUrl);
  
        return { info: metadata, logs };
      } catch (e: any) {
        // If there's a top-level error outside probeVideo
        logs.push(`Top-level error in browser code: ${e.message}`);
        return { info: null, logs };
      }
    }, SAMPLE_VIDEO_URL);
  
    // Now on the Node side, we always get a `result` with logs
    console.log("BROWSER DEBUG LOGS:\n", result.logs.join("\n"));
  
    if (!result.info) {
      // If there's an error, throw it so the test fails, but we still see logs
      throw new Error(`Browser code failed: See logs above}`);
    }
  
    // If no error, proceed with normal checks
    const { info } = result;
    expect(info).toBeDefined();
    expect(info).toHaveProperty('fps');
    expect(info).toHaveProperty('totalFrames');
    expect(info).toHaveProperty('width');
    expect(info).toHaveProperty('height');
    expect(info).toHaveProperty('codec');
    expect(info).toHaveProperty('bitrate');
    expect(info).toHaveProperty('rotation');
    expect(info).toHaveProperty('issues');
  }, 20000);
  
  // it('should process a real video file in the browser', async () => {
  //   const options = {
  //     crop: { x0: 0, y0: 0, x1: 100, y1: 100 },
  //     scale: { width: 40, height: 40 },
  //     pixelFormat: 'rgb24',
  //   };

  //   const probeInfo = {
  //     fps: 30,
  //     totalFrames: 354,
  //     width: 640,
  //     height: 480,
  //     codec: 'h264',
  //     bitrate: 13051,
  //     rotation: 0,
  //     issues: false,
  //   };

  //   const buffer = await page.evaluate(async (videoUrl, opts, probe) => {
  //     const wrapper = new (window as any).FFmpegWrapper();
  //     await wrapper.init();
  //     return await wrapper.readVideo(videoUrl, opts, probe);
  //   }, SAMPLE_VIDEO_URL, options, probeInfo);

  //   expect(buffer).toBeDefined();
  //   expect(buffer).toBeInstanceOf(Uint8Array);
  //   expect(buffer.length).toBeGreaterThan(0);
  // }, 30000);
});
