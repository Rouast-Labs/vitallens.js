# Examples & Usage Recipes

<!-- mkdocs-start -->
The `examples/` folder contains ready-to-run applications demonstrating the Web Components, the Core Browser API, and Node.js file processing.

## Running the Included Examples

To run these examples locally, you must first build the project and start the local development server.

**1. Build the library**

```bash
npm install
npm run build
```

**2. Run an example**

Select a target below and run the command. Replace `YOUR_KEY` with your actual API Key.

| Category | Description | Command |
| --- | --- | --- |
| **Web Component** | **Vitals Scan:** A 30-second guided health check wizard. | `API_KEY=YOUR_KEY npm run start:scan` |
| **Web Component** | **Vitals Monitor:** Continuous monitor. | `API_KEY=YOUR_KEY npm run start:monitor` |
| **Web Component** | **File Processing:** Analyze a video file. | `API_KEY=YOUR_KEY npm run start:file` |
| **Web Component** | **Advanced Widget:** Advanced tool for switching methods/files. | `API_KEY=YOUR_KEY npm run start:widget` |
| **Core API** | **Minimal Webcam:** Raw `VitalLens` class with custom HTML. | `API_KEY=YOUR_KEY npm run start:webcam-minimal` |
| **Node.js** | **File Processing:** Analyze a video file server-side. | `API_KEY=YOUR_KEY npm run start:file-node` |

---

## Integration Recipes

Patterns for solving common integration challenges.

### Minimal Browser Setup (CDN)

The quickest way to get started without a build step. This uses the raw `VitalLens` class to analyze a webcam feed.

```html
<video id="my-video" autoplay muted playsinline></video>

<script type="module">
  import { VitalLens } from 'https://cdn.jsdelivr.net/npm/vitallens';

  (async () => {
    try {
      const videoElement = document.getElementById('my-video');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoElement.srcObject = stream;

      const vl = new VitalLens({ method: 'vitallens', apiKey: 'YOUR_API_KEY' });

      // Attach stream and start
      await vl.setVideoStream(stream, videoElement);
      
      vl.addEventListener('vitals', (result) => {
        console.log('Heart Rate:', result.vitals.heart_rate.value);
      });
      
      vl.startVideoStream();
    } catch (err) {
      console.error("Failed to start VitalLens:", err);
    }
  })();
</script>
```

### Stream Lifecycle (Pause/Resume)

You are responsible for managing the stream lifecycle. This pattern shows how to toggle processing to save bandwidth when the user isn't actively looking at the results.

```javascript
let isProcessing = true;
const btn = document.getElementById('toggle-btn');

btn.onclick = () => {
  if (isProcessing) {
    // Pauses API calls, but keeps the webcam active
    vl.pauseVideoStream();
    btn.textContent = 'Resume';
  } else {
    // Resumes API calls
    vl.startVideoStream();
    btn.textContent = 'Pause';
  }
  isProcessing = !isProcessing;
};

// Cleanup when leaving the page
window.onbeforeunload = () => {
  vl.stopVideoStream();
};
```

### Robustness & Auto-Reconnect

Real-world networks are unstable. The library emits a `streamReset` event when the connection drops. You should listen for this to automatically recover the session.

```javascript
vl.addEventListener('streamReset', (event) => {
  console.warn('Stream was reset:', event.message);
  
  // 1. Notify user and stop the old stream
  showToast('Connection unstable. Reconnecting...');
  vl.stopVideoStream();

  // 2. Wait a moment and restart
  setTimeout(async () => {
    try {
      // Re-acquire media (good practice to ensure fresh state)
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoElement.srcObject = stream;
      
      await vl.setVideoStream(stream, videoElement);
      vl.startVideoStream();
      
      hideToast();
    } catch (err) {
      showError('Could not reconnect. Please refresh.');
    }
  }, 3000);
});
```

### Node.js File Processing

Process a video file on the server.

```javascript
import { VitalLens } from 'vitallens';

const vl = new VitalLens({
  method: 'vitallens',
  apiKey: process.env.VITALLENS_API_KEY
});

// Listen for progress updates
vl.addEventListener('fileProgress', (msg) => console.log(msg));

async function run() {
  try {
    const result = await vl.processVideoFile('./examples/sample_video_1.mp4');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Processing failed:', error);
  } finally {
    await vl.close();
  }
}

run();
```

### Web Component: Health Check Wizard (`vitals-scan`)

Use this for a guided, one-time measurement (e.g., in a telemedicine waiting room).

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/vitallens/dist/vitallens.browser.js"></script>

<vitallens-vitals-scan 
    api-key="YOUR_API_KEY"
    default-mode="standard">
</vitallens-vitals-scan>
```

### Web Component: Dashboard Monitor (`vitals-monitor`)

Use this for continuous monitoring in a fitness dashboard or wellness app. It has a minimal footprint.

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/vitallens/dist/vitallens.browser.js"></script>

<vitallens-vitals-monitor 
    api-key="YOUR_API_KEY"
    default-mode="eco">
</vitallens-vitals-monitor>
```

### Web Component: Advanced Tool (`widget`)

Use this for internal tools, admin panels, or debugging. It allows switching between webcam and file inputs.

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/vitallens/dist/vitallens.browser.js"></script>

<div style="width: 100%; height: 600px;">
    <vitallens-widget 
        api-key="YOUR_API_KEY" 
        method="vitallens">
    </vitallens-widget>
</div>
```