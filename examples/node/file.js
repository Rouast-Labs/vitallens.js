import { VitalLens } from '../../dist/vitallens.esm.js';

const apiKey = process.env.API_KEY || 'YOUR_API_KEY'; // Replace with your actual API key if not provided via env

const options = {
  method: 'vitallens',
  apiKey,
};

const vitallens = new VitalLens(options);

async function processFile(filePath) {
  try {
    const results = await vitallens.processVideoFile(filePath);
    console.log('Processing Results:', results);
  } catch (error) {
    console.error('Error processing file:', error);
  } finally {
    await vitallens.close();
  }
}

// Replace with the path to your video file
const videoFilePath = './examples/sample_video_1.mp4';
processFile(videoFilePath);
