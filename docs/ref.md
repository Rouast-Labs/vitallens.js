# JavaScript API Reference

The `VitalLens` class is the main entry point for the library.

**Environment Support:**

- **Browser:** Supports both **Real-time Streaming** (Webcam) and **File Processing**.
- **Node.js:** Supports **File Processing** only. Calling streaming methods in Node.js will throw an error.

## Constructor

```javascript
new VitalLens(options)
```

**Method Options:**

You can choose from several rPPG methods to control how inference is performed:

- `vitallens`: **(Recommended)** Uses the VitalLens API and automatically selects the best model available for your API key (e.g., VitalLens 2.0 with HRV support).
- `vitallens-2.0`: Forces the use of the VitalLens 2.0 model.
- `vitallens-1.0` / `vitallens-1.1`: Forces the use of older model versions.
- `pos`, `chrom`, `g`: Classic rPPG algorithms that run locally (in the browser or Node.js) and do not require an API key.

**Parameters:**

| Name | Type | Description | Default |
| --- | --- | --- | --- |
| `method` | `string` | The rPPG method to be used for inference (see options above). | `'vitallens'` |
| `apiKey` | `string` | Your API Key. Required if `method` starts with `vitallens`. | `undefined` |
| `proxyUrl` | `string` | URL to a backend proxy to hide your API Key (Recommended for production). | `undefined` |
| `waveformMode` | `string` | How waveforms are returned: `"incremental"`, `"windowed"`, or `"complete"`. | `'windowed'` |
| `fDetFs` | `number` | Face detection frequency in Hz (Live stream only). | `1.0` |

---

## Methods

### `setVideoStream(stream, videoElement)`

*(Browser Only)*

Manually attaches a `MediaStream` and a `<video>` element to the client. Useful if you are managing camera permissions in your own app logic.

**Parameters:**

* `stream`: `MediaStream` object.
* `videoElement`: (Optional) `HTMLVideoElement` to render the feed.

```javascript
const stream = await navigator.mediaDevices.getUserMedia({ video: true });
await vl.setVideoStream(stream, document.getElementById('myVideo'));
```

### `startVideoStream()`

*(Browser Only)*

Starts the camera stream and begins processing. If a stream hasn't been set via `setVideoStream`, it attempts to acquire the user's webcam automatically.

```javascript
vl.startVideoStream();
```

### `pauseVideoStream()`

*(Browser Only)*

Pauses data transmission to the API. The camera remains active, but inference stops to save bandwidth/costs.

```javascript
vl.pauseVideoStream();
```

### `stopVideoStream()`

*(Browser Only)*

Stops inference, releases the camera/media stream, and clears internal buffers.

```javascript
vl.stopVideoStream();
```

### `processVideoFile(input)`

Processes a video file in batch mode. Supported in both **Browser** and **Node.js**.

**Parameters:**

* `input`: `File`, `Blob`, or `string` (path, Node.js only).

**Returns:** `Promise<VitalLensResult>`

```javascript
// Browser
const result = await vl.processVideoFile(fileInput.files[0]);

// Node.js
const result = await vl.processVideoFile("./video.mp4");
```

### `addEventListener(event, callback)`

Registers a listener for specific library events.

**Supported Events:**

- `"vitals"`: *(Browser Only)* Emitted continuously during streaming with the latest estimation results.
- `"streamReset"`: *(Browser Only)* Emitted if the connection is unstable and the stream needs to restart.
- `"faceDetected"`: *(Browser Only)* Emitted when the local face detector updates (contains bounding box).
- `"fileProgress"`: Emitted during file processing with status strings (e.g. "Detecting faces...").

```javascript
vl.addEventListener('vitals', (result) => {
  console.log(result.vital_signs.heart_rate.value);
});
```

### `close()`

Disposes of the instance, terminates background workers, and cleans up memory.

```javascript
await vl.close();
```