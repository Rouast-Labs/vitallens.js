import { FrameIteratorFactory } from '../../src/processing/FrameIteratorFactory';
import { StreamFrameIterator } from '../../src/processing/StreamFrameIterator';
import { MethodConfig } from '../../src/types';

global.MediaStream = class MediaStream {
  active = true;
  id = 'mock-stream-id';
  getTracks = jest.fn();
  getAudioTracks = jest.fn();
  getVideoTracks = jest.fn();
  addTrack = jest.fn();
  removeTrack = jest.fn();
  clone = jest.fn();
  onaddtrack = null;
  onremovetrack = null;
} as unknown as typeof MediaStream;

describe('FrameIteratorFactory (Browser)', () => {
  let factory: FrameIteratorFactory;
  const mockMethodConfig: MethodConfig = {
    method: 'vitallens-1.0',
    inputSize: 40,
    fpsTarget: 30,
    roiMethod: 'face',
    minWindowLength: 5,
    maxWindowLength: 10,
    requiresState: false,
    bufferOffset: 1,
    supportedVitals: ['ppg_waveform', 'heart_rate'],
  };

  it('should create a StreamFrameIterator with MediaStream', () => {
    factory = new FrameIteratorFactory(
      { method: 'vitallens' },
      () => mockMethodConfig
    );
    const stream = new MediaStream();
    const iterator = factory.createStreamFrameIterator(stream);
    expect(iterator).toBeInstanceOf(StreamFrameIterator);
  });

  it('should create a StreamFrameIterator with HTMLVideoElement', () => {
    factory = new FrameIteratorFactory(
      { method: 'vitallens' },
      () => mockMethodConfig
    );
    const videoElement = document.createElement('video') as HTMLVideoElement;

    // Mock the `srcObject` property to accept a MediaStream
    Object.defineProperty(videoElement, 'srcObject', {
      value: new MediaStream(),
      writable: true,
    });

    const iterator = factory.createStreamFrameIterator(undefined, videoElement);
    expect(iterator).toBeInstanceOf(StreamFrameIterator);
  });

  it('should throw an error if neither MediaStream nor HTMLVideoElement is provided', () => {
    expect(() => factory.createStreamFrameIterator()).toThrow(
      'Either a MediaStream or an HTMLVideoElement must be provided.'
    );
  });
});
