import { VitalLens } from 'vitallens.js';

const options = {
  method: 'vitallens',
  globalRoi: { x0: 50, y0: 50, y1: 250, y1: 250 },
};

const vitallens = new VitalLens(options);

async function processMediaStream(mediaStream) {
  try {
    // Assume the client already manages this video element
    const videoElement = document.getElementById('clientVideo');
    if (!videoElement) {
      throw new Error('Client-managed video element not found');
    }

    await vitallens.addStream(mediaStream, videoElement);

    vitallens.addEventListener('vitals', (result) => {
      console.log('Vitals:', result.vitals);
    });

    vitallens.start();
  } catch (error) {
    console.error('Error processing MediaStream:', error);
  }
}

// Example: Getting a MediaStream (e.g., from getUserMedia or WebRTC)
navigator.mediaDevices
  .getUserMedia({ video: true })
  .then((stream) => {
    const videoElement = document.createElement('video');
    videoElement.id = 'clientVideo';
    videoElement.srcObject = stream;
    videoElement.muted = true;
    videoElement.playsInline = true;
    videoElement.autoplay = true;
    document.body.appendChild(videoElement);

    processMediaStream(stream);
  })
  .catch((error) => {
    console.error('Error accessing webcam:', error);
  });
