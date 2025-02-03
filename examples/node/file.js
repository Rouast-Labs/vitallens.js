import { VitalLens } from '../../dist/vitallens.esm.js';

const options = {
  method: 'vitallens',
  apiKey: 'YOUR_API_KEY', // Replace with actual API key
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
const videoFilePath = './examples/sample_video_1.mp4';
processFile(videoFilePath);