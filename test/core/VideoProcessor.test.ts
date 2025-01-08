import { VideoProcessor } from '../../src/core/VideoProcessor';
import { VitalLensOptions } from '../../src/types/core';
import fs from 'fs';

jest.mock('fs');
jest.mock('sharp');

describe('VideoProcessor', () => {
  const mockOptions: VitalLensOptions = {
    method: 'vitallens',
    fps: 30,
    roi: { x: 50, y: 50, width: 200, height: 200 },
  };

  let videoProcessor: VideoProcessor;

  beforeEach(() => {
    videoProcessor = new VideoProcessor(mockOptions);
  });

  it('should initialize with correct options', () => {
    expect(videoProcessor).toBeInstanceOf(VideoProcessor);
  });

  it('should call the frame callback during frame capture', () => {
    const mockVideoElement = document.createElement('video');
    const frameCallback = jest.fn();

    jest.spyOn(videoProcessor as any, 'captureFrame').mockReturnValue({
      data: 'mock-frame-data',
      timestamp: 123,
    });

    videoProcessor.startFrameCapture(mockVideoElement, frameCallback);

    expect(frameCallback).toHaveBeenCalledWith({
      data: 'mock-frame-data',
      timestamp: 123,
    });
  });

  it('should preprocess frames correctly', () => {
    const mockFrame = {
      data: 'mock-frame-data',
      timestamp: 123,
    };
    const preprocessSpy = jest.spyOn(videoProcessor as any, 'preprocessFrame');
    videoProcessor.preprocessFrame(mockFrame, mockOptions.roi);

    expect(preprocessSpy).toHaveBeenCalledWith(mockFrame, mockOptions.roi);
  });

  it('should extract frames from a video file', async () => {
    const mockFilePath = './video.mp4';
    const mockFrames = [Buffer.from('frame1'), Buffer.from('frame2')];

    jest.spyOn(videoProcessor as any, 'extractFramesFromFile').mockResolvedValue(mockFrames);

    const frames = await videoProcessor.extractFramesFromFile(mockFilePath);

    expect(frames).toEqual(mockFrames);
  });

  it('should handle errors during frame extraction', async () => {
    const mockFilePath = './video.mp4';

    jest.spyOn(videoProcessor as any, 'extractFramesFromFile').mockRejectedValue(new Error('Test Error'));

    await expect(videoProcessor.extractFramesFromFile(mockFilePath)).rejects.toThrow('Test Error');
  });
});
