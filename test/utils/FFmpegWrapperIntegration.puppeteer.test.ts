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

  describe('Puppeteer Debug', () => {
    it('Prints navigator info', async () => {
      await page.goto('http://localhost:8080/');
      const flags = await page.evaluate(() => navigator.userAgent);
      console.log('Puppeteer Flags:', flags);
    });
  });

  it('loads ffmpeg.wasm safely', async () => {
    await page.setBypassCSP(true);
    await page.goto(`http://localhost:8080`);
    // Inject script
    await page.addScriptTag({
      url: 'http://localhost:8080/utils/FFmpegWrapper.browser.umd.js',
      type: 'module',
    });
    const logs = await page.evaluate(async () => {
      const logs = [];
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
  }, 90000);
});
