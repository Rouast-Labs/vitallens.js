import { VitalLens } from 'vitallens.js';

const options = {
  method: 'pos',
  apiKey: 'YOUR_API_KEY',
  globalRoi: { x: 50, y: 50, width: 200, height: 200 },
};

const vitallens = new VitalLens(options);

async function processFile(filePath) {
  try {
    const results = await vitallens.processFile(filePath);
    console.log('Processing Results:', results);
  } catch (error) {
    console.error('Error processing file:', error);
  }
}

// Replace with the path to your video file
const videoFilePath = './sample-video.mp4';
processFile(videoFilePath);