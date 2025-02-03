# VitalLens.js

[![NPM Version](https://badge.fury.io/js/vitallens.js.svg)](https://www.npmjs.com/package/vitallens.js)
[![Website](https://img.shields.io/badge/Website-rouast.com/api-blue.svg?logo=data:image/svg%2bxml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+Cjxzdmcgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgdmlld0JveD0iMCAwIDI0IDI0IiB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHhtbDpzcGFjZT0icHJlc2VydmUiIHhtbG5zOnNlcmlmPSJodHRwOi8vd3d3LnNlcmlmLmNvbS8iIHN0eWxlPSJmaWxsLXJ1bGU6ZXZlbm9kZDtjbGlwLXJ1bGU6ZXZlbm9kZDtzdHJva2UtbGluZWpvaW46cm91bmQ7c3Ryb2tlLW1pdGVybGltaXQ6MjsiPgogICAgPGcgdHJhbnNmb3JtPSJtYXRyaXgoMC4xODc5OTgsMCwwLDAuMTg3OTk4LDIzLjMyOTYsMTIuMjQ1MykiPgogICAgICAgIDxwYXRoIGQ9Ik0wLC0yLjgyOEMwLjMzOSwtMi41OTYgMC42NzQsLTIuMzk3IDEuMDA1LC0yLjIyNkwzLjU2NiwtMTUuODczQzAuMjY5LC0yMy42NTYgLTMuMTc1LC0zMS42MTUgLTkuNjU1LC0zMS42MTVDLTE2LjQ2MiwtMzEuNjE1IC0xNy41NDgsLTIzLjk0MiAtMTkuOTQ3LDAuMzEyQy0yMC40MjEsNS4wODEgLTIxLjAzOCwxMS4zMDggLTIxLjcxMSwxNi4wMzFDLTI0LjAxNiwxMS45NTQgLTI2LjY3NSw2LjU0OSAtMjguNDIsMy4wMDJDLTMzLjQ3OSwtNy4yNzggLTM0LjY2NSwtOS4zOTQgLTM2Ljg4OCwtMTAuNTM0Qy0zOS4wMzMsLTExLjYzOSAtNDAuOTk1LC0xMS41OTEgLTQyLjM3MSwtMTEuNDA4Qy00My4wMzcsLTEzIC00My45NDQsLTE1LjQzMSAtNDQuNjY4LC0xNy4zNjdDLTQ5LjUyOSwtMzAuMzkxIC01MS43NzIsLTM1LjQxMiAtNTYuMDY2LC0zNi40NTNDLTU3LjU2NiwtMzYuODE3IC01OS4xNDYsLTM2LjQ5MSAtNjAuMzk5LC0zNS41NjJDLTYzLjQyOCwtMzMuMzI0IC02NC4wMTYsLTI5LjYwMSAtNjUuNjUsLTIuMzcxQy02Ni4wMTcsMy43NDcgLTY2LjQ5NSwxMS43MTMgLTY3LjA1NiwxNy43NzZDLTY5LjE4MiwxNC4xMDggLTcxLjUyNiw5Ljc4MiAtNzMuMjY5LDYuNTcxQy04MS4wNTgsLTcuNzk0IC04Mi42ODcsLTEwLjQyMiAtODUuNzE5LC0xMS4zMUMtODcuNjQ2LC0xMS44NzcgLTg5LjIyMywtMTEuNjYgLTkwLjQyNSwtMTEuMjQ0Qy05MS4yOTYsLTEzLjM3NCAtOTIuNDM0LC0xNi45NzkgLTkzLjI1NSwtMTkuNTgzQy05Ni42LC0zMC4xODkgLTk4LjYyLC0zNi41ODggLTEwNC4xMzUsLTM2LjU4OEMtMTEwLjQ4NCwtMzYuNTg4IC0xMTAuODQzLC0zMC4zOTEgLTExMi4zNTUsLTQuMzExQy0xMTIuNzA3LDEuNzUgLTExMy4xNjksOS43NDIgLTExMy43NDEsMTUuNTUxQy0xMTYuMywxMS43ODEgLTExOS4yOSw2Ljk3OSAtMTIxLjQ1LDMuNDlMLTEyNC4wOTUsMTcuNTc2Qy0xMTcuNjA3LDI3LjU4NSAtMTE0Ljc2NiwzMC40NTggLTExMS4yMDQsMzAuNDU4Qy0xMDQuNjAzLDMwLjQ1OCAtMTA0LjIyMiwyMy44OTMgLTEwMi42MjEsLTMuNzQ3Qy0xMDIuNDIyLC03LjE3IC0xMDIuMTk3LC0xMS4wNDYgLTEwMS45NDYsLTE0LjcyOUMtOTkuNTUxLC03LjIxNiAtOTguMTkyLC0zLjY4NSAtOTUuNTQxLC0yLjA1Qy05Mi42OTgsLTAuMjk3IC05MC4zOTgsLTAuNTQ3IC04OC44MTMsLTEuMTU3Qy04Ny4wNCwxLjYyOSAtODQuMTExLDcuMDMgLTgxLjg0LDExLjIyQy03MS45NTUsMjkuNDQ2IC02OS4yMDIsMzMuNzM1IC02NC44NDYsMzMuOTc1Qy02NC42NjEsMzMuOTg1IC02NC40OCwzMy45ODkgLTY0LjMwNSwzMy45ODlDLTU4LjA2NCwzMy45ODkgLTU3LjY2MiwyNy4zMDQgLTU1LjkxNywtMS43ODdDLTU1LjYzMSwtNi41MyAtNTUuMywtMTIuMDcgLTU0LjkyNywtMTYuOTQ4Qy01NC41MTIsLTE1Ljg1MiAtNTQuMTI5LC0xNC44MjkgLTUzLjgwMywtMTMuOTU1Qy01MS4wNTYsLTYuNTk0IC01MC4xODcsLTQuNDExIC00OC40NzMsLTMuMDQyQy00NS44NywtMC45NjIgLTQzLjE0OSwtMS4zNjkgLTQxLjczNywtMS42MjhDLTQwLjYwMiwwLjMyOSAtMzguNjY0LDQuMjcxIC0zNy4xNjksNy4zMDZDLTI4LjgyNSwyNC4yNjQgLTI1LjE2OCwzMC42NzMgLTE5LjgxMiwzMC42NzNDLTEzLjE1NSwzMC42NzMgLTEyLjM2MiwyMi42NjYgLTEwLjI0NCwxLjI3MkMtOS42NjMsLTQuNjA2IC04Ljg4MiwtMTIuNDk2IC03Ljk5NiwtMTcuODMxQy02Ljk2MywtMTUuNzI5IC01Ljk1NCwtMTMuMzUgLTUuMzA3LC0xMS44MkMtMy4xNDUsLTYuNzIxIC0yLjAxNywtNC4yMDkgMCwtMi44MjgiIHN0eWxlPSJmaWxsOnJnYigwLDE2NCwyMjQpO2ZpbGwtcnVsZTpub256ZXJvOyIvPgogICAgPC9nPgo8L3N2Zz4K)](https://www.rouast.com/api/)
[![Documentation](https://img.shields.io/badge/Docs-docs.rouast.com-blue.svg?logo=data:image/svg%2bxml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+Cjxzdmcgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgdmlld0JveD0iMCAwIDI0IDI0IiB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHhtbDpzcGFjZT0icHJlc2VydmUiIHhtbG5zOnNlcmlmPSJodHRwOi8vd3d3LnNlcmlmLmNvbS8iIHN0eWxlPSJmaWxsLXJ1bGU6ZXZlbm9kZDtjbGlwLXJ1bGU6ZXZlbm9kZDtzdHJva2UtbGluZWpvaW46cm91bmQ7c3Ryb2tlLW1pdGVybGltaXQ6MjsiPgogICAgPGcgdHJhbnNmb3JtPSJtYXRyaXgoMC4xODc5OTgsMCwwLDAuMTg3OTk4LDIzLjMyOTYsMTIuMjQ1MykiPgogICAgICAgIDxwYXRoIGQ9Ik0wLC0yLjgyOEMwLjMzOSwtMi41OTYgMC42NzQsLTIuMzk3IDEuMDA1LC0yLjIyNkwzLjU2NiwtMTUuODczQzAuMjY5LC0yMy42NTYgLTMuMTc1LC0zMS42MTUgLTkuNjU1LC0zMS42MTVDLTE2LjQ2MiwtMzEuNjE1IC0xNy41NDgsLTIzLjk0MiAtMTkuOTQ3LDAuMzEyQy0yMC40MjEsNS4wODEgLTIxLjAzOCwxMS4zMDggLTIxLjcxMSwxNi4wMzFDLTI0LjAxNiwxMS45NTQgLTI2LjY3NSw2LjU0OSAtMjguNDIsMy4wMDJDLTMzLjQ3OSwtNy4yNzggLTM0LjY2NSwtOS4zOTQgLTM2Ljg4OCwtMTAuNTM0Qy0zOS4wMzMsLTExLjYzOSAtNDAuOTk1LC0xMS41OTEgLTQyLjM3MSwtMTEuNDA4Qy00My4wMzcsLTEzIC00My45NDQsLTE1LjQzMSAtNDQuNjY4LC0xNy4zNjdDLTQ5LjUyOSwtMzAuMzkxIC01MS43NzIsLTM1LjQxMiAtNTYuMDY2LC0zNi40NTNDLTU3LjU2NiwtMzYuODE3IC01OS4xNDYsLTM2LjQ5MSAtNjAuMzk5LC0zNS41NjJDLTYzLjQyOCwtMzMuMzI0IC02NC4wMTYsLTI5LjYwMSAtNjUuNjUsLTIuMzcxQy02Ni4wMTcsMy43NDcgLTY2LjQ5NSwxMS43MTMgLTY3LjA1NiwxNy43NzZDLTY5LjE4MiwxNC4xMDggLTcxLjUyNiw5Ljc4MiAtNzMuMjY5LDYuNTcxQy04MS4wNTgsLTcuNzk0IC04Mi42ODcsLTEwLjQyMiAtODUuNzE5LC0xMS4zMUMtODcuNjQ2LC0xMS44NzcgLTg5LjIyMywtMTEuNjYgLTkwLjQyNSwtMTEuMjQ0Qy05MS4yOTYsLTEzLjM3NCAtOTIuNDM0LC0xNi45NzkgLTkzLjI1NSwtMTkuNTgzQy05Ni42LC0zMC4xODkgLTk4LjYyLC0zNi41ODggLTEwNC4xMzUsLTM2LjU4OEMtMTEwLjQ4NCwtMzYuNTg4IC0xMTAuODQzLC0zMC4zOTEgLTExMi4zNTUsLTQuMzExQy0xMTIuNzA3LDEuNzUgLTExMy4xNjksOS43NDIgLTExMy43NDEsMTUuNTUxQy0xMTYuMywxMS43ODEgLTExOS4yOSw2Ljk3OSAtMTIxLjQ1LDMuNDlMLTEyNC4wOTUsMTcuNTc2Qy0xMTcuNjA3LDI3LjU4NSAtMTE0Ljc2NiwzMC40NTggLTExMS4yMDQsMzAuNDU4Qy0xMDQuNjAzLDMwLjQ1OCAtMTA0LjIyMiwyMy44OTMgLTEwMi42MjEsLTMuNzQ3Qy0xMDIuNDIyLC03LjE3IC0xMDIuMTk3LC0xMS4wNDYgLTEwMS45NDYsLTE0LjcyOUMtOTkuNTUxLC03LjIxNiAtOTguMTkyLC0zLjY4NSAtOTUuNTQxLC0yLjA1Qy05Mi42OTgsLTAuMjk3IC05MC4zOTgsLTAuNTQ3IC04OC44MTMsLTEuMTU3Qy04Ny4wNCwxLjYyOSAtODQuMTExLDcuMDMgLTgxLjg0LDExLjIyQy03MS45NTUsMjkuNDQ2IC02OS4yMDIsMzMuNzM1IC02NC44NDYsMzMuOTc1Qy02NC42NjEsMzMuOTg1IC02NC40OCwzMy45ODkgLTY0LjMwNSwzMy45ODlDLTU4LjA2NCwzMy45ODkgLTU3LjY2MiwyNy4zMDQgLTU1LjkxNywtMS43ODdDLTU1LjYzMSwtNi41MyAtNTUuMywtMTIuMDcgLTU0LjkyNywtMTYuOTQ4Qy01NC41MTIsLTE1Ljg1MiAtNTQuMTI5LC0xNC44MjkgLTUzLjgwMywtMTMuOTU1Qy01MS4wNTYsLTYuNTk0IC01MC4xODcsLTQuNDExIC00OC40NzMsLTMuMDQyQy00NS44NywtMC45NjIgLTQzLjE0OSwtMS4zNjkgLTQxLjczNywtMS42MjhDLTQwLjYwMiwwLjMyOSAtMzguNjY0LDQuMjcxIC0zNy4xNjksNy4zMDZDLTI4LjgyNSwyNC4yNjQgLTI1LjE2OCwzMC42NzMgLTE5LjgxMiwzMC42NzNDLTEzLjE1NSwzMC42NzMgLTEyLjM2MiwyMi42NjYgLTEwLjI0NCwxLjI3MkMtOS42NjMsLTQuNjA2IC04Ljg4MiwtMTIuNDk2IC03Ljk5NiwtMTcuODMxQy02Ljk2MywtMTUuNzI5IC01Ljk1NCwtMTMuMzUgLTUuMzA3LC0xMS44MkMtMy4xNDUsLTYuNzIxIC0yLjAxNywtNC4yMDkgMCwtMi44MjgiIHN0eWxlPSJmaWxsOnJnYigwLDE2NCwyMjQpO2ZpbGwtcnVsZTpub256ZXJvOyIvPgogICAgPC9nPgo8L3N2Zz4K)](https://docs.rouast.com/)
[![DOI](http://img.shields.io/:DOI-10.48550/arXiv.2312.06892-blue.svg?style=flat&logo=arxiv)](https://doi.org/10.48550/arXiv.2312.06892)

Estimate vital signs such as heart rate and respiratory rate from video in JavaScript.

`vitallens.js` is a JavaScript client for the [**VitalLens API**](https://www.rouast.com/vitallens/), which leverages the same inference engine as our [free iOS app VitalLens](https://apps.apple.com/us/app/vitallens/id6472757649).
Furthermore, it includes fast implementations of several other heart rate estimation methods from video such as `G`, `CHROM`, and `POS`.

This library works both in browser environments and in Node.js, and comes with a set of examples for file-based processing and real-time webcam streaming.

## Features

- **Cross-Platform Compatibility:**  
  Use vitallens.js in the browser or Node.js.

- **Flexible Input Support:**
  Process video files or live streams from a webcam or any MediaStream.

- **Multiple Estimation Methods:**
  Choose the method that fits your needs:
  - **`vitallens`** provides *heart rate*, *respiratory rate*, *pulse waveform*, and *respiratory waveform* estimation. In addition, it returns an estimation confidence for each vital. We are working to support more vital signs in the future.
  - **`g`**, **`chrom`**, **`pos`** provides support faster, but less accurate *heart rate* and *pulse waveform* estimation.
  - While `vitallens` requires an API Key, `g`, `chrom`, and `pos` do not. [Register on our website to get a free API Key.](https://www.rouast.com/api/)

- **Fast Face Detection & ROI Support:**  
  Perform rapid face detection when required—or optionally, pass a global region of interest (ROI) to skip detection for even faster processing.

- **Event-Driven API:**  
  Register event listeners to receive real-time updates on estimated vitals.
  
- **TypeScript-Ready:**  
  Written in TypeScript with complete type definitions for enhanced developer experience.
  
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
| `globalRoi`   | Optional region of interest for face detection (object with `{ x0, y0, x1, y1 }`).              | `undefined`   |
| *Others*      | Additional options (e.g., face detection settings, buffering) are available. See [docs](https://docs.rouast.com/) for details. |               |

## Examples

The repository contains several ready-to-run examples:

- **Browser File Input:**  
  [examples/browser/file.html](examples/browser/file.html)  
  To run this example, execute:
  ```bash
  npm run start:browser-file
  ```

- **Minimal Webcam Example:**  
  [examples/browser/webcam_minimal.html](examples/browser/webcam_minimal.html)  
  To run this example, execute:
  ```bash
  npm run start:browser-webcam-minimal
  ```

- **Advanced Webcam with Visualizations:**  
  [examples/browser/webcam.html](examples/browser/webcam.html)  
  To run this example, execute:
  ```bash
  npm run start:browser-webcam
  ```

- **Node File Processing:**  
  [examples/node/file.js](examples/node/file.js)  
  To run this example, execute:
  ```bash
  npm run start:node-file
  ```

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
