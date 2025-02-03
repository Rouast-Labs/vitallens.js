// Import VitalLens
import { VitalLens } from '../vitallens.browser.js';

const options = {
  method: 'vitallens',
  apiKey: "YOUR_API_KEY", // Replace with actual API key
};

const vitallens = new VitalLens(options);
let isProcessing = false;
let stopTimeout = null;

const MAX_DATA_POINTS = 300;

const charts = {
  ppgChart: createChart('ppgChart', 'Pulse', 'red'),
  respChart: createChart('respChart', 'Respiration', 'blue'),
};

function createChart(elementId, label, color) {
  return new Chart(document.getElementById(elementId).getContext('2d'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label,
        data: [],
        borderColor: color,
        borderWidth: 2,
        tension: 0,
        pointRadius: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'start',
          labels: {
            boxWidth: 0,
            color,
            font: { size: 16, weight: 'bold' },
          },
        },
      },
      animation: false,      
      scales: { x: { display: false }, y: { display: false } },
    },
  });
}

function updateChart(chart, newData) {
  let dataToDisplay = newData?.length ? newData : new Array(MAX_DATA_POINTS).fill(0);

  if (dataToDisplay.length > MAX_DATA_POINTS) {
    dataToDisplay = dataToDisplay.slice(-MAX_DATA_POINTS);
  }

  if (dataToDisplay.length < MAX_DATA_POINTS) {
    const zerosNeeded = MAX_DATA_POINTS - dataToDisplay.length;
    const zeroPad = new Array(zerosNeeded).fill(0);
    dataToDisplay = zeroPad.concat(dataToDisplay);
  }

  chart.data.datasets[0].data = dataToDisplay;
  chart.data.labels = Array.from({ length: MAX_DATA_POINTS }, (_, i) => i);

  chart.update();
}

function drawFaceBox(canvas, video, coordinates) {
  if (!coordinates || !coordinates.length) return;

  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);

  setCanvasDimensions(canvas);

  const [x0, y0, x1, y1] = coordinates[coordinates.length - 1];
  const w = x1 - x0;
  const h = y1 - y0;

  const containerWidth = canvas.width;
  const containerHeight = canvas.height;

  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;
  const videoAspect = videoWidth / videoHeight;
  const containerAspect = containerWidth / containerHeight;

  let displayedVideoWidth, displayedVideoHeight, offsetX, offsetY;

  if (videoAspect > containerAspect) {
    displayedVideoWidth = containerWidth;
    displayedVideoHeight = containerWidth / videoAspect;
    offsetX = 0;
    offsetY = (containerHeight - displayedVideoHeight) / 2;
  } else {
    displayedVideoHeight = containerHeight;
    displayedVideoWidth = containerHeight * videoAspect;
    offsetX = (containerWidth - displayedVideoWidth) / 2;
    offsetY = 0;
  }

  const scaleX = displayedVideoWidth / videoWidth;
  const scaleY = displayedVideoHeight / videoHeight;

  const boxX = offsetX + x0 * scaleX;
  const boxY = offsetY + y0 * scaleY;
  const boxW = w * scaleX;
  const boxH = h * scaleY;

  context.strokeStyle = 'rgba(0, 255, 0, 0.8)';
  context.lineWidth = 2;
  context.strokeRect(boxX, boxY, boxW, boxH);
}

function setCanvasDimensions(canvas) {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}

// VitalLens Event Handlers
function handleVitalLensResults(result) {
  const { face, vital_signs } = result;
  const canvas = document.getElementById('canvas');
  const video = document.getElementById('video');

  if (!face?.coordinates) {
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
  } else if (face?.coordinates?.length) {
    drawFaceBox(canvas, video, face.coordinates);
  }

  const { ppg_waveform, respiratory_waveform, heart_rate, respiratory_rate } = vital_signs;

  updateChart(charts.ppgChart, ppg_waveform?.data || []);
  updateChart(charts.respChart, respiratory_waveform?.data || []);

  updateStats('ppgStats', 'HR   bpm', heart_rate?.value);
  updateStats('respStats', 'RR   bpm', respiratory_rate?.value);
}

function updateStats(elementId, label, value) {
  const element = document.getElementById(elementId);
  if (!element) return;
  const color = elementId === 'ppgStats' ? 'red' : 'blue';
  element.innerHTML = `
    <p style="font-size: 16px; margin: 10px 0 0; font-weight: bold; color: ${color};">${label}</p>
    <p style="font-size: 48px; margin: 16px 0 0; font-weight: bold; color: ${color};">${value !== undefined ? value.toFixed(0) : 'N/A'}</p>
  `;
}

function handleResize() {
  const canvas = document.getElementById('canvas');
  setCanvasDimensions(canvas);
  charts.ppgChart.resize();
  charts.ppgChart.update();
  charts.respChart.resize();
  charts.respChart.update();
}

// Start/Stop VitalLens
function toggleVitalLens() {
  if (isProcessing) {
    clearTimeout(stopTimeout);
    vitallens.pauseVideoStream();
    handleVitalLensResults({ face: {}, vital_signs: {} });
    console.log('VitalLens paused.');
  } else {
    vitallens.startVideoStream();
    console.log('VitalLens started.');
    stopTimeout = setTimeout(toggleVitalLens, 30000);
  }
  isProcessing = !isProcessing;
}

async function startVitalLens() {
  if (!isProcessing) {
    vitallens.addEventListener('vitals', handleVitalLensResults);
    vitallens.startVideoStream();
    console.log('VitalLens started.');
    isProcessing = true;
    stopTimeout = setTimeout(toggleVitalLens, 30000);
  }
}

// Webcam Setup
async function setupCamera() {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');

  if (!video || !canvas) {
    console.error('Video or canvas element not found.');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user' } });
    video.srcObject = stream;
    await vitallens.addVideoStream(stream, video);

    video.onloadeddata = () => {
      setCanvasDimensions(canvas);
      video.play();

      startVitalLens();

      video.addEventListener('click', toggleVitalLens);
      window.addEventListener('resize', handleResize);
    };
  } catch (err) {
    console.error('Camera Error:', err);
  }
}

// App Initialization
window.onload = async () => {
  console.log('Initializing VitalLens...');
  await setupCamera();
};
