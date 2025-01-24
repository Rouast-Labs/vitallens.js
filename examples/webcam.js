import { VitalLens } from '../dist/vitallens.browser.js';

// Configuration
const options = {
  method: 'vitallens',
  // fDetFs: 0.1,
  apiKey: "YOUR_API_KEY",
  globalRoi: { x: 200, y: 70, width: 250, height: 300 },
};

const vitallens = new VitalLens(options);

// Helper to log messages
function log(...txt) {
  console.log(...txt); // eslint-disable-line no-console
  const div = document.getElementById('log');
  if (div) div.innerHTML += `<br>${txt}`;
}

// Helper to draw ROIs and vital stats
function drawVitals(canvas, video, result) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clear the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw FPS
  ctx.font = 'small-caps 20px "Segoe UI"';
  ctx.fillStyle = 'white';
  if (result.fps) ctx.fillText(`FPS (Webcam): ${result.fps.toFixed(1)}`, 10, 25);
  if (result.estFps) ctx.fillText(`FPS (Estimation): ${result.estFps.toFixed(1)}`, 10, 50);

  // Draw ROIs
  if (result.face && result.face.coordinates.length > 0) {
    const roi = result.face.coordinates[0];
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

  // Draw Heart Rate
  ctx.fillStyle = 'red';
  ctx.globalAlpha = 1;
  if (result.vital_signs.heart_rate?.value) {
    ctx.fillText(`Heart Rate: ${result.vital_signs.heart_rate.value.toFixed(0) || 'N/A'} bpm`, 10, 75);
  } 
}

async function detectVitals(video, canvas) {
  vitallens.addEventListener('vitals', (result) => {
    drawVitals(canvas, video, result);
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
