const path = require('path');
const puppeteer = require('puppeteer');
const http = require('http');
const express = require('express');

describe('FFmpegWrapper (Browser)', () => {
  let browser;
  let page;
  let server;
  const PORT = 8080;

  beforeAll(async () => {
    const app = express();

    app.use((_, res, next) => {
      res.set({
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "Origin-Agent-Cluster": "?1",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Origin, X-Requested-With, Content-Type, Accept, Range",
      });
      next();
    });

    app.use('/dist', express.static(path.join(__dirname, '../../dist')));
    
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '../../examples/webcam.html'));
    });

    server = http.createServer(app).listen(PORT, () => {
      console.log(`Test server running at http://localhost:${PORT}`);
    });

    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--enable-features=SharedArrayBuffer',
        '--disable-site-isolation-trials',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });
  });

  afterAll(async () => {
    // Close Puppeteer and server
    if (browser) await browser.close();
    if (server) server.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();

    page.on('console', (msg) => {
      console.log(`BROWSER LOG: ${msg.type().toUpperCase()}: ${msg.text()}`);
    });

    page.on('request', (request) => {
      console.log(`Request: ${request.method()} ${request.url()}`);
    });

    page.on('response', async (response) => {
      console.log(`Response: ${response.url()} - ${response.status()}`);
    });

    page.on('pageerror', (err) => {
      console.error(`PAGE ERROR: ${err.toString()}`);
    });

    page.on('requestfailed', (request) => {
      console.error(`Request failed: ${request.url()} (${request.failure()?.errorText || 'Unknown error'})`);
    });
  });

  afterEach(async () => {
    if (page) await page.close();
  });

  it('loads ffmpeg.wasm safely', async () => {
    await page.goto(`http://localhost:${PORT}/index.html`);
    // Inject script
    await page.addScriptTag({
      url: `http://localhost:${PORT}/dist/utils/FFmpegWrapper.browser.umd.js`,
    });
    const logs = await page.evaluate(async () => {
      const logs = [];
      logs.push('Initializing FFmpegWrapper...');
      const wrapper = new window.FFmpegWrapper();
      try {
        await wrapper.init();
        logs.push('FFmpegWrapper initialized successfully');
      } catch (error) {
        logs.push(`Error during initialization: ${error.message}`);
      }
      return logs;
    });
    console.log('BROWSER LOGS:', logs.join('\n'));
    expect(logs).toContain('FFmpegWrapper initialized successfully');
  }, 35000);
});
