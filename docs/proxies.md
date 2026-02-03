# Security & Proxies

For security reasons, you should never expose your VitalLens API key directly in client-side (browser) code. The recommended approach is to route traffic through a simple backend proxy that attaches your credentials securely.

## 1. Configure the Client

Configure `vitallens.js` to point to your proxy instead of the VitalLens API directly.

```javascript
import { VitalLens } from 'vitallens';

const vl = new VitalLens({
  method: 'vitallens',
  // The client will append /resolve-model and /stream to this base URL
  proxyUrl: 'https://your-proxy-server.com/api' 
});
```

Or when using one of our widgets:

```html
<vitallens-widget proxy-url="https://your-proxy-server.com/api"></vitallens-widget>
```

## 2. Implement the Proxy

Your proxy server needs to handle two types of requests:

1. **`GET /resolve-model`**: For model configuration.
2. **`POST /stream` (or `/file`)**: For sending video data.

Below is a production-ready example using Node.js and Express.

### Sample Implementation

```javascript
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Securely store your API key in an environment variable
const API_KEY = process.env.VITALLENS_API_KEY;
const API_BASE = 'https://api.rouast.com/vitallens-v3';

// Increase limit for video file uploads if necessary
app.use(bodyParser.json({ limit: '50mb' }));

// Enable CORS for your allowed domain
app.use(cors({
  origin: 'http://example.com', // Your allowed domain
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Encoding', 'X-State']
}));

// 1. Forward Model Resolution
app.get('/resolve-model', async (req, res) => {
  try {
    const upstreamUrl = new URL(`${API_BASE}/resolve-model`);
    upstreamUrl.search = new URLSearchParams(req.query).toString();

    const response = await fetch(upstreamUrl, {
      method: 'GET',
      headers: { 'x-api-key': API_KEY },
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy Resolve error:', error);
    res.status(500).send('Internal server error');
  }
});

// 2. Forward Stream/Inference
app.post(['/stream', '/file'], async (req, res) => {
  try {
    // Forward to the exact same path on the upstream API
    const upstreamUrl = `${API_BASE}${req.path}`;
    
    const response = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'x-api-key': API_KEY,
        // Forward custom headers used by the client
        'X-Encoding': req.headers['x-encoding'] || '',
        'X-State': req.headers['x-state'] || ''
      },
      body: req.headers['content-type'] === 'application/json' 
            ? JSON.stringify(req.body) 
            : req.body
    });
    
    const data = await response.text();
    res.status(response.status).send(data);
  } catch (error) {
    console.error('Proxy Inference error:', error);
    res.status(500).send('Internal server error');
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server listening on port ${PORT}`);
});
```