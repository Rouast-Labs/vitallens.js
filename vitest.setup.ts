import { vi } from 'vitest';
import { TextEncoder, TextDecoder } from 'util';
import * as tf from '@tensorflow/tfjs';

(globalThis as any).TextEncoder = TextEncoder;
(globalThis as any).TextDecoder = TextDecoder;

const originalWarn = console.warn;

console.warn = (message, ...args) => {
  if (
    typeof message === 'string' && (
      message.includes('is already registered') ||
      message.includes('was already registered') ||
      message.includes('has already been set') ||
      message.includes('Hi, looks like')
    )
  ) {
    return;
  }
  originalWarn(message, ...args);
};

const isBrowser =
  typeof window !== 'undefined' && typeof window.document !== 'undefined';

if (isBrowser) {
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });

  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: vi.fn(),
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

  tf.setBackend('cpu');
}