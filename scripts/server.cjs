/* eslint-disable @typescript-eslint/no-require-imports */
const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 8080;

// Set security headers
app.use((_, res, next) => {
  res.set({
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Origin-Agent-Cluster': '?1',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'Origin, X-Requested-With, X-Origin, X-State, X-Encoding, Content-Type, Accept, Range',
    'Content-Security-Policy':
      "default-src 'self' blob: data:; " +
      "script-src-elem 'self' 'unsafe-inline' 'unsafe-eval' blob: https://unpkg.com/ https://cdn.jsdelivr.net; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://unpkg.com/ https://cdn.jsdelivr.net; " +
      "worker-src 'self' blob:; " +
      "connect-src 'self' blob: data: https://unpkg.com/ https://api.rouast.com; " +
      "style-src 'self' 'unsafe-inline';",
  });
  next();
});

// Serve static files for examples and dist
app.use(express.static(path.join(__dirname, '../dist')));

// Handle dynamic example selection
app.get('/browser/:example', (req, res) => {
  const example = req.params.example;
  const examplePath = path.join(
    __dirname,
    '../examples',
    'browser',
    example + '.html'
  );
  fs.readFile(examplePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(404).send('Example not found');
    }
    // Inject the API key into the HTML by replacing the placeholder
    const apiKey = process.env.API_KEY || 'YOUR_API_KEY';
    const updatedHTML = data.replace('YOUR_API_KEY', apiKey);
    res.send(updatedHTML);
  });
});

// Serve static files for non-browser examples
app.use(express.static(path.join(__dirname, '../examples')));

// Start server and optionally open browser if EXAMPLE_TO_OPEN is set
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  const exampleToOpen = process.env.EXAMPLE_TO_OPEN;
  if (exampleToOpen) {
    const url = `http://localhost:${PORT}/${exampleToOpen}`;
    // Open the browser based on OS
    const platform = process.platform;
    if (platform === 'win32') {
      exec(`start ${url}`);
    } else if (platform === 'darwin') {
      exec(`open ${url}`);
    } else {
      exec(`xdg-open ${url}`);
    }
  }
});
