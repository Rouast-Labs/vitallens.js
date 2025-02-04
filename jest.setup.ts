import * as tf from '@tensorflow/tfjs';

const originalWarn = console.warn;

console.warn = (message, ...args) => {
  // Suppress specific TensorFlow.js warnings
  if (
    message.includes('is already registered') ||
    message.includes('was already registered') ||
    message.includes('has already been set') ||
    message.includes('Hi, looks like')
  ) {
    return;
  }

  // Call the original console.warn for other warnings
  originalWarn(message, ...args);
};

// Check if the environment is Node.js or browser
const isBrowser =
  typeof window !== 'undefined' && typeof window.document !== 'undefined';

if (isBrowser) {
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: jest.fn().mockResolvedValue(undefined),
  });

  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: jest.fn(),
  });

  Object.defineProperty(HTMLMediaElement.prototype, 'muted', {
    configurable: true,
    get() {
      return this._muted || false;
    },
    set(value) {
      this._muted = value;
    },
  });

  Object.defineProperty(HTMLMediaElement.prototype, 'playsInline', {
    configurable: true,
    get() {
      return this._playsInline || false;
    },
    set(value) {
      this._playsInline = value;
    },
  });

  // Force TensorFlow.js to use the CPU backend for browser tests
  tf.setBackend('cpu');
}
