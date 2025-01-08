import { VitalLens } from '../../src/core/VitalLens';
import { VitalLensOptions, VitalLensResult } from '../../src/types/core';
import { jest } from '@jest/globals';

describe('VitalLens', () => {
  const mockOptions: VitalLensOptions = {
    method: 'vitallens',
    fps: 30,
    roi: { x: 50, y: 50, width: 200, height: 200 },
    apiEndpoint: 'wss://api.vitallens.com',
  };

  let vitalLens: VitalLens;

  beforeEach(() => {
    vitalLens = new VitalLens(mockOptions);
  });

  it('should initialize with correct options', () => {
    expect(vitalLens).toBeInstanceOf(VitalLens);
  });

  it('should throw error for invalid video source', async () => {
    const invalidSource: any = 12345; // Invalid source
    await expect(vitalLens.estimateVitals(invalidSource)).rejects.toThrow('Invalid video source');
  });

  it('should call processWebcam for HTMLVideoElement', async () => {
    const mockVideoElement = document.createElement('video');
    const processWebcamSpy = jest.spyOn(vitalLens as any, 'processWebcam').mockResolvedValue({} as VitalLensResult);

    await vitalLens.estimateVitals(mockVideoElement);
    expect(processWebcamSpy).toHaveBeenCalled();
  });

  it('should call processVideoFile for file path', async () => {
    const mockFilePath = './video.mp4';
    const processVideoFileSpy = jest.spyOn(vitalLens as any, 'processVideoFile').mockResolvedValue([]);

    await vitalLens.estimateVitals(mockFilePath);
    expect(processVideoFileSpy).toHaveBeenCalled();
  });

  it('should handle errors gracefully during video analysis', async () => {
    const mockFilePath = './video.mp4';
    jest.spyOn(vitalLens as any, 'processVideoFile').mockRejectedValue(new Error('Test Error'));

    await expect(vitalLens.estimateVitals(mockFilePath)).rejects.toThrow('Test Error');
  });
});
