module.exports = {
  launch: {
    headless: true,
    args: [
      '--disable-web-security',
      '--allow-running-insecure-content',
      '--ignore-certificate-errors',
      '--enable-features=SharedArrayBuffer',
      '--disable-site-isolation-trials',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  },
  server: {
    command: 'node scripts/server.cjs',
    port: 8080,
    launchTimeout: 60000,
    debug: true,
  },
};
