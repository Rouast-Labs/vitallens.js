// Import VitalLens
import { VitalLens } from './dist/vitallens.browser.js';

const options = {
  method: 'vitallens',
  waveformDataMode: 'aggregated',
  apiKey: "YOUR_API_KEY",
  globalRoi: { x: 200, y: 70, width: 250, height: 300 },
};

const vitallens = new VitalLens(options);
let isProcessing = false;
let stopTimeout = null;

const MAX_DATA_POINTS = 300;

// Initialize charts
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
        tension: 0.3,
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
      scales: { x: { display: false }, y: { display: false } },
    },
  });
}

function updateChart(chart, data) {
  chart.data.datasets[0].data.push(...data);
  chart.data.labels.push(...data.map((_, i) => i));

  if (chart.data.datasets[0].data.length > MAX_DATA_POINTS) {
    chart.data.datasets[0].data = chart.data.datasets[0].data.slice(-MAX_DATA_POINTS);
    chart.data.labels = chart.data.labels.slice(-MAX_DATA_POINTS);
  }

  chart.update();
}

function drawFaceBox(canvas, video, coordinates) {
  const context = canvas.getContext('2d');

  // Clear the canvas
  context.clearRect(0, 0, canvas.width, canvas.height);

  // Ensure the canvas matches the video dimensions
  canvas.width = video.offsetWidth;
  canvas.height = video.offsetHeight;

  // Check if coordinates are valid
  if (!coordinates || coordinates.length === 0) {
    console.warn('No coordinates provided to drawFaceBox.');
    return;
  }

  // Get the most recent face box coordinates
  const [x, y, width, height] = coordinates[coordinates.length - 1];

  // Scale the coordinates to the current video size
  const scaleX = canvas.width / video.videoWidth;
  const scaleY = canvas.height / video.videoHeight;

  const adjustedX = x * scaleX;
  const adjustedY = y * scaleY;
  const adjustedWidth = width * scaleX;
  const adjustedHeight = height * scaleY;

  // Draw the face box
  context.strokeStyle = 'rgba(0, 255, 0, 0.8)';
  context.lineWidth = 2;
  context.strokeRect(adjustedX, adjustedY, adjustedWidth, adjustedHeight);
}

// VitalLens Event Handlers
function handleVitalLensResults(result) {
  const { face, vital_signs } = result;
  const canvas = document.getElementById('canvas');
  const video = document.getElementById('video');

  if (face?.coordinates?.length) {
    drawFaceBox(canvas, video, face.coordinates);
  }

  const { ppg_waveform, respiratory_waveform, heart_rate, respiratory_rate } = result.vital_signs;

  if (ppg_waveform?.data) updateChart(charts.ppgChart, ppg_waveform.data);
  if (respiratory_waveform?.data) updateChart(charts.respChart, respiratory_waveform.data);

  updateStats('ppgStats', 'HR   bpm', heart_rate?.value);
  updateStats('respStats', 'RR   bpm', respiratory_rate?.value);
}

function updateStats(elementId, label, value) {
  const element = document.getElementById(elementId);
  if (!element) return;
  const color = elementId === 'ppgStats' ? 'red' : 'blue';
  element.innerHTML = `
    <p style="font-size: 12px; margin: 0; color: ${color};">${label}</p>
    <p style="font-size: 48px; margin: 16px 0 0; font-weight: bold; color: ${color};">${value?.toFixed(0) || 'N/A'}</p>
  `;
}

// Layout Adjustment
function adjustVideoLayout(video) {
  const canvas = document.getElementById('canvas');
  const chartsContainer = document.querySelector('.charts-container');
  const availableHeight = window.innerHeight - chartsContainer.offsetHeight;
  const availableWidth = window.innerWidth;

  const videoAspectRatio = video.videoWidth / video.videoHeight;
  const availableAspectRatio = availableWidth / availableHeight;

  if (videoAspectRatio > availableAspectRatio) {
    // Fit by width, add black bars on top and bottom
    video.style.width = '100%';
    video.style.height = 'auto';
    video.style.objectFit = 'contain';
    video.style.position = 'absolute';
    video.style.top = `${(availableHeight - video.offsetHeight) / 2}px`;
    video.style.left = '0';

    // Sync canvas dimensions and position
    canvas.style.width = video.style.width;
    canvas.style.height = video.offsetHeight + 'px';
    canvas.style.top = video.style.top;
    canvas.style.left = video.style.left;
  } else {
    // Fit by height, add black bars on left and right
    video.style.width = 'auto';
    video.style.height = `${availableHeight}px`;
    video.style.objectFit = 'contain';
    video.style.position = 'absolute';
    video.style.top = '0';
    video.style.left = `${(availableWidth - video.offsetWidth) / 2}px`;

    // Sync canvas dimensions and position
    canvas.style.width = video.offsetWidth + 'px';
    canvas.style.height = video.style.height;
    canvas.style.top = video.style.top;
    canvas.style.left = video.style.left;
  }
}

function adjustChartsAndStatsLayout() {
  const chartsContainer = document.querySelector('.charts-container');
  const statsElements = document.querySelectorAll('.stats-container');

  if (chartsContainer) {
    chartsContainer.style.height = `${window.innerHeight * 0.4}px`;
    chartsContainer.style.width = '100%';
  }

  statsElements.forEach((stats) => {
    stats.style.height = `${window.innerHeight * 0.2}px`;
    stats.style.width = '100%';
  });
}

// Start/Stop VitalLens
function toggleVitalLens() {
  if (isProcessing) {
    clearTimeout(stopTimeout);
    vitallens.pause();
    console.log('VitalLens paused.');
  } else {
    vitallens.start();
    console.log('VitalLens started.');
    stopTimeout = setTimeout(toggleVitalLens, 30000);
  }
  isProcessing = !isProcessing;
}

async function startVitalLens() {
  if (!isProcessing) {
    vitallens.addEventListener('vitals', handleVitalLensResults);
    vitallens.start();
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
    await vitallens.addStream(stream, video);

    video.onloadeddata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      adjustVideoLayout(video);
      adjustChartsAndStatsLayout();
      video.play();

      startVitalLens();

      video.addEventListener('click', toggleVitalLens);
      window.addEventListener('resize', () => {
        adjustVideoLayout(video);
        adjustChartsAndStatsLayout();
      });
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
