import { VitalLens } from '../dist/vitallens.browser.js';

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const options = {
  method: 'g',
  globalRoi: { x: 50, y: 50, width: 200, height: 200 },
};

const vitallens = new VitalLens(options);

async function startWebcam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;

    await vitallens.addStream(stream, video);

    vitallens.addEventListener('vitals', (result) => {
      console.log('Vitals:', result);
      drawVitals(result);
    });

    vitallens.start();
  } catch (error) {
    console.error('Error accessing webcam:', error);
  }
}

function drawVitals(result) {
  const video = document.querySelector('video');
  if (!video) return;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'red';
  ctx.font = '20px Arial';
  ctx.fillText(`Heart Rate: ${result.vitals.heartRate} bpm`, 10, 30);
}

startWebcam();
