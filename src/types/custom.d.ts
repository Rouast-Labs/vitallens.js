declare module '*.json' {
  const value: string; // Treated as Base64 string
  export default value;
}

declare module '*.bin' {
  const value: string; // Base64 string
  export default value;
}

declare module '*ffmpeg-worker.bundle.js' {
  const value: string;
  export default value;
}

declare module '*faceDetection.worker.browser.bundle.js' {
  const value: string;
  export default value;
}

declare module '*faceDetection.worker.node.bundle.js' {
  const value: string;
  export default value;
}
