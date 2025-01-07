// VitalLens API WebSocket endpoint
export const API_URL = "wss://<your-websocket-endpoint>"; // Replace <your-websocket-endpoint> with the actual endpoint

// Default backend for TensorFlow.js (can be overridden if needed)
export const DEFAULT_TF_BACKEND = "webgl";

// Frame processing settings
export const FRAME_PROCESSING = {
  TARGET_SIZE: 40, // Target width and height for processed frames (in pixels)
};

// Model URLs for methods
export const MODEL_URLS = {
  FACE_DETECTION: "./models/face-detection-model.json", // Path to face detection model
  G: "./models/g-model.json",                          // Path to G method model
  POS: "./models/pos-model.json",                      // Path to POS method model
  CHROM: "./models/chrom-model.json",                  // Path to CHROM method model
};

// Logging options
export const LOGGING = {
  ENABLE_DEBUG: true, // Set to false to disable debug logs
};
