// examples/node/analyze-video.ts
import { VitalLens } from "../../dist/vitallens.js";

async function main() {
  const videoFilePath = "./sample-video.mp4"; // Path to your video file
  console.log(`Analyzing video file: ${videoFilePath}`);

  try {
    // Initialize VitalLens instance
    const vitalLens = new VitalLens("https://your-rest-endpoint");

    // Analyze video file using the specified method
    const results = await vitalLens.analyzeVideoFile(videoFilePath, "vitalLensAPI");

    console.log("Vitals Estimation Results:");
    console.log(JSON.stringify(results, null, 2));
  } catch (error) {
    console.error("Error analyzing video file:", error.message);
  }
}

main();
