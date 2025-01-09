const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

jest.setTimeout(20000); // Set a global timeout for this test file

describe('FFmpegWrapper (Browser Integration)', () => {
  let browser;

  beforeAll(async () => {
    jest.setTimeout(20000); // Increase the timeout for this test suite
    try {
      browser = await puppeteer.launch();
    } catch (error) {
      console.error('Failed to launch Puppeteer:', error);
      throw error;
    }
  });

  afterAll(async () => {
    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        console.error('Failed to close Puppeteer:', error);
      }
    }
  });

  it('should process a real video file in the browser', async () => {
    const videoPath = path.resolve(__dirname, '../../examples/sample_video_1.mp4');
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Sample video not found: ${videoPath}`);
    }

    const fileBuffer = fs.readFileSync(videoPath);
    const videoBase64 = fileBuffer.toString('base64');

    const page = await browser.newPage();
    await page.goto('http://localhost:8080'); // Your testing server URL

    const result = await page.evaluate(async (base64Video) => {
      const FFmpegWrapper = window.FFmpegWrapper; // Assuming FFmpegWrapper is globally available
      const wrapper = new FFmpegWrapper();
      await wrapper.init();

      const videoBlob = new Blob([Uint8Array.from(atob(base64Video), (c) => c.charCodeAt(0))], {
        type: 'video/mp4',
      });

      const file = new File([videoBlob], 'sample.mp4');
      const buffer = await wrapper.readVideo(file, { scale: { width: 100, height: 100 }, pixelFormat: 'rgb24' });

      return buffer.byteLength; // Return processed data length
    }, videoBase64);

    expect(result).toBeGreaterThan(0);
  });
});
