declare module '*.json' {
  const value: string; // Treated as Base64 string
  export default value;
}

declare module '*.bin' {
  const value: string; // Base64 string
  export default value;
}

declare module '*.html' {
  const value: string;
  export default value;
}

declare module '*.png' {
  const value: string;
  export default value;
}

declare module '*ffmpeg.worker.bundle.js' {
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

declare module 'tfjs-provider' {
  import * as tf from '@tensorflow/tfjs';
  export * from '@tensorflow/tfjs';
  export default tf;
}
