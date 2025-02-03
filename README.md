# VitalLens.js

[![NPM Version](https://badge.fury.io/js/vitallens.js.svg)](https://www.npmjs.com/package/vitallens.js)
[![Website](https://img.shields.io/badge/Website-rouast.com/api-blue.svg)](https://www.rouast.com/)
[![Documentation](https://img.shields.io/badge/Docs-docs.rouast.com-blue.svg)](https://docs.rouast.com/)

Estimate vital signs such as heart rate and respiratory rate from video in JavaScript.

`vitallens.js` is a JavaScript client for the [**VitalLens API**](https://www.rouast.com/vitallens/), which leverages the same inference engine as our [free iOS app VitalLens](https://apps.apple.com/us/app/vitallens/id6472757649).
Furthermore, it includes fast implementations of several other heart rate estimation methods from video such as `G`, `CHROM`, and `POS`.

This library works both in browser environments and in Node.js, and comes with a set of examples for file-based processing and real-time webcam streaming.

## Features

- **Cross-Platform Compatibility:**  
  Use vitallens.js in the browser or Node.js.
  
- **Multiple Estimation Methods:**
  Choose the method that fits your needs:
  - **`vitallens`** (requires an API key) – provides robust vital sign and waveform estimates.
  - **`g`**, **`chrom`**, **`pos`** – faster alternatives for less accurate heart rate estimation without an API key.
  
- **Flexible Input Support:**  
  Process video files or live streams from a webcam or any MediaStream.
  
- **Event-Driven API:**  
  Register event listeners to receive real-time updates on estimated vitals.
  
- **TypeScript-Ready:**  
  Written in TypeScript with complete type definitions for enhanced developer experience.
  
- **Well-Tested and Documented:**  
  Includes extensive tests (both Node and browser) and example applications to get you started quickly.

### Disclaimer

**Important:** vitallens.js provides vital sign estimates for general wellness purposes only. It is **not intended for medical use**. Always consult a healthcare professional for any medical concerns or precise clinical measurements.

Please review our [Terms of Service](https://www.rouast.com/api/terms) and [Privacy Policy](https://www.rouast.com/privacy) for more details.

## Installation

Install vitallens.js via npm:

```bash
npm install vitallens.js
```

Or using yarn:

```bash
yarn add vitallens.js
```

## Usage

### Importing the Library

#### In Browser (ES Modules)

Include vitallens.js in your HTML as follows:

```html
<script type="module">
  import { VitalLens } from 'vitallens.browser.js';
  // Your code here
</script>
```

#### In Node.js (ESM)

```js
import { VitalLens } from 'vitallens.esm.js';
// Your code here
```

### Processing a Video File (Node.js Example)

```js
import { VitalLens } from 'vitallens.esm.js';

const options = {
  method: 'vitallens',      // Choose from 'vitallens', 'g', 'chrom', or 'pos'
  apiKey: 'YOUR_API_KEY',   // Required when using the 'vitallens' method
};

const vitallens = new VitalLens(options);

async function processVideoFile(filePath) {
  try {
    const result = await vitallens.processFile(filePath);
    console.log('Processing complete!', result);
  } catch (error) {
    console.error('Error processing video:', error);
  }
}

processVideoFile('./examples/sample_video_1.mp4');
```

### Real-Time Vital Estimation (Browser Example)

Below is a minimal example that uses a webcam stream:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>vitallens.js Webcam Example</title>
</head>
<body>
  <video id="video" autoplay muted playsinline style="width:100%; max-width:600px;"></video>
  <script type="module">
    import { VitalLens } from 'vitallens.browser.js';

    const options = {
      method: 'vitallens',  // 'vitallens' requires an API key
      apiKey: 'YOUR_API_KEY',
    };

    const vitallens = new VitalLens(options);

    async function startVitals() {
      try {
        const video = document.getElementById('video');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false
        });
        video.srcObject = stream;

        // Add the stream to vitallens.js
        await vitallens.addStream(stream, video);

        // Listen for vitals events
        vitallens.addEventListener('vitals', (data) => {
          console.log('Detected vitals:', data);
        });

        // Start processing
        vitallens.start();
      } catch (error) {
        console.error('Error initializing webcam:', error);
      }
    }

    startVitals();
  </script>
</body>
</html>
```

### Configuration Options

When creating a new `VitalLens` instance, you can configure various options:

| Parameter     | Description                                                                                      | Default       |
| ------------- | ------------------------------------------------------------------------------------------------ | ------------- |
| `method`      | Inference method: `'vitallens'`, `'G'`, `'CHROM'`, or `'POS'`.                                  | `'vitallens'` |
| `apiKey`      | API key for the VitalLens API (required for method `'vitallens'`).                               | `null`        |
| `requestMode` | Request mode for `'vitallens'`: either `'rest'` or `'websocket'` (when applicable).              | `'rest'`      |
| `globalRoi`   | Optional region of interest for face detection (object with `{ x0, y0, x1, y1 }`).              | `undefined`   |
| *Others*      | Additional options (e.g., face detection settings, buffering) are available. See [docs](https://docs.rouast.com/) for details. |               |

## Examples

The repository contains several ready-to-run examples:

- **Browser File Input:** [examples/browser/file.html](examples/browser/file.html)
- **Minimal Webcam Example:** [examples/browser/webcam_minimal.html](examples/browser/webcam_minimal.html)
- **Advanced Webcam with Visualizations:** [examples/browser/webcam.html](examples/browser/webcam.html)
- **Node File Processing:** [examples/node/file.js](examples/node/file.js)

Try opening the HTML examples in your browser or running the Node script to see vitallens.js in action.

## Development

### Building the Library

To build the project from source, run:

```bash
npm run build
```

This compiles the TypeScript source and bundles the output for Node (both ESM and CommonJS), and the browser.

### Running Tests

Execute the test suite with:

```bash
npm test
```

For environment-specific tests, you can use:

```bash
npm run test:browser
npm run test:node
```

### Linting

Lint the code using:

```bash
npm run lint
```

## License

This project is licensed under the [MIT License](LICENSE).
