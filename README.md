# VitalLens.js

**VitalLens.js** is a modern JavaScript/TypeScript library for estimating vital signs, such as heart rate and respiratory rate, from video data. It supports live webcam streams, video files, and media streams, and integrates seamlessly with both browser and Node.js environments.

## Features

- **Estimate Vital Signs**: Supports methods like `VitalLens` (neural network-based) and `POS` (handcrafted rPPG).
- **WebSocket and REST API Integration**: Use the VitalLens API for advanced neural network estimation.
- **Cross-Platform**: Works in both browser and Node.js environments.
- **Flexible Input Options**:
  - Live webcam streams
  - Pre-recorded video files
  - Media streams
- **ROI (Region of Interest) Support**: Process only the desired part of the video for efficient computation.
- **Lightweight and Modern**: Built with TypeScript, optimized for modern JavaScript ecosystems.

---

## Installation

```bash
npm install vitallens
```

---

## Usage

### 1. Live Webcam Stream in the Browser

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VitalLens Webcam Example</title>
  <script type="module">
    import { VitalLens } from 'vitallens';

    const options = {
      method: 'vitallens',
      fps: 30,
      roi: { x: 50, y: 50, width: 200, height: 200 },
    };

    const vitallens = new VitalLens(options);

    async function startWebcam() {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      vitallens.addStream(stream);

      vitallens.addEventListener('vitals', (result) => {
        console.log('Vitals:', result.vitals);
      });

      vitallens.start();
    }

    startWebcam();
  </script>
</head>
<body>
  <h1>VitalLens Webcam Example</h1>
</body>
</html>
```

---

### 2. MediaStream Integration

If you already have a `MediaStream` (e.g., from a WebRTC connection), you can process it directly.

```javascript
import { VitalLens } from 'vitallens';

const options = {
  method: 'pos',
  fps: 30,
  roi: { x: 50, y: 50, width: 200, height: 200 },
};

const vitallens = new VitalLens(options);

async function processMediaStream(mediaStream) {
  vitallens.addStream(mediaStream);

  vitallens.addEventListener('vitals', (result) => {
    console.log('Vitals:', result.vitals);
  });

  vitallens.start();
}

// Example: Get a MediaStream from getUserMedia
navigator.mediaDevices
  .getUserMedia({ video: true })
  .then(processMediaStream)
  .catch(console.error);
```

---

### 3. Video File Processing in Node.js

```javascript
import { VitalLens } from 'vitallens';

const options = {
  method: 'vitallens',
  fps: 30,
  roi: { x: 50, y: 50, width: 200, height: 200 },
};

const vitallens = new VitalLens(options);

(async () => {
  const results = await vitallens.processFile('./path/to/video.mp4');
  console.log('Vitals Results:', results);
})();
```

---

## API Reference

### VitalLens Constructor

```typescript
new VitalLens(options: VitalLensOptions);
```

#### `VitalLensOptions`
| Option     | Type                         | Description                                    |
|------------|------------------------------|------------------------------------------------|
| `method`   | `'vitallens' | 'pos'`         | Estimation method to use.                     |
| `fps`      | `number`                     | Frames per second to process.                 |
| `roi`      | `{ x: number; y: number; width: number; height: number }` | Region of interest for processing. |

---

### Methods

#### `addStream(stream: MediaStream): Promise<void>`
Adds a `MediaStream` for processing.

#### `processFile(filePath: string): Promise<VitalLensResult[]>`
Processes a video file and returns the results.

#### `addEventListener(event: string, callback: (data: any) => void): void`
Registers an event listener for specific events like `'vitals'`.

#### `start(): void`
Starts the processing loop for live streams.

#### `stop(): void`
Stops all ongoing processing.

---

## Development

### Build the Library
```bash
npm run build
```

### Run Examples
- **Browser Example**:
  ```bash
  npm run serve
  ```
  Then open `http://127.0.0.1:8080/examples/webcam.html` in your browser.

- **Node.js Example**:
  ```bash
  npm start
  ```

### Run Tests
```bash
npm test
```

---

## Contributing

Contributions are welcome! If you encounter any issues or have feature requests, feel free to open a GitHub issue or submit a pull request.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## Acknowledgements

- Powered by [@ffmpeg/ffmpeg](https://github.com/ffmpegwasm/ffmpeg.wasm) and [TensorFlow.js](https://github.com/tensorflow/tfjs).
- Developed by **Rouast Labs**.
