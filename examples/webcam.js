import { VitalLens } from '../dist/vitallens.browser.js';

// Configuration
const options = {
  method: 'g',
  fDetFs: 0.1,
  // globalRoi: { x: 50, y: 50, width: 200, height: 200 },
};

const vitallens = new VitalLens(options);

// Helper to log messages
function log(...txt) {
  console.log(...txt); // eslint-disable-line no-console
  const div = document.getElementById('log');
  if (div) div.innerHTML += `<br>${txt}`;
}

// Helper to draw ROIs and vital stats
function drawVitals(canvas, video, result, fps) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clear the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw FPS
  ctx.font = 'small-caps 20px "Segoe UI"';
  ctx.fillStyle = 'white';
  ctx.fillText(`FPS: ${fps}`, 10, 25);

  // Draw ROIs
  if (result.face && result.face.length > 0) {
    for (const roi of result.face) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'red';
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.rect(
        roi.x * canvas.width / video.videoWidth,
        roi.y * canvas.height / video.videoHeight,
        roi.width * canvas.width / video.videoWidth,
        roi.height * canvas.height / video.videoHeight
      );
      ctx.stroke();
    }
  }

  // Draw Heart Rate
  ctx.fillStyle = 'red';
  ctx.globalAlpha = 1;
  ctx.fillText(`Heart Rate: ${result.vitals.heartRate || 'N/A'} bpm`, 10, 50);
}

async function detectVitals(video, canvas) {
  const t0 = performance.now();
  vitallens.addEventListener('vitals', (result) => {
    const fps = 1000 / (performance.now() - t0);
    drawVitals(canvas, video, result, fps.toFixed(1));
  });
  vitallens.start();
}

// Initialize webcam and start detection
async function setupCamera() {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  if (!video || !canvas) return;

  log('Setting up camera...');
  if (!navigator.mediaDevices) {
    log('Camera Error: access not supported');
    return;
  }

  const constraints = { audio: false, video: { facingMode: 'user' } };
  const stream = await navigator.mediaDevices.getUserMedia(constraints).catch((err) => {
    log('Camera Error:', err.message);
    return null;
  });

  if (!stream) return;

  video.srcObject = stream;
  await vitallens.addStream(stream, video);

  video.onloadeddata = () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    video.play();
    detectVitals(video, canvas);
  };
}

// Start the application
window.onload = async () => {
  log('Initializing VitalLens...');
  await setupCamera();
};
