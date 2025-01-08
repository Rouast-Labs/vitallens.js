import { VitalLens } from '../../src/core/VitalLens';
import { VitalLensOptions, VitalLensResult } from '../../src/types/core';
import { Frame } from '../../src/types/core';

jest.mock('../../src/utils/WebSocketClient');
jest.mock('../../src/core/VideoProcessor');

describe('Integration Tests for VitalLens', () => {
  const mockOptions: VitalLensOptions = {
    method: 'vitallens',
    fps: 30,
    roi: { x: 50, y: 50, width: 200, height: 200 },
    apiEndpoint: 'wss://api.vitallens.com',
  };

  const mockFrames: Frame[] = [
    { data: 'frame1-data', timestamp: 1 },
    { data: 'frame2-data', timestamp: 2 },
  ];

  let vitalLens: VitalLens;

  beforeEach(() => {
    vitalLens = new VitalLens(mockOptions);
  });

  it('should process webcam frames and return vitals', async () => {
    const mockVideoElement = document.createElement('video');
    const mockResult: VitalLensResult = {
      vitals: { heartRate: 72, respiratoryRate: 18 },
      state: { mockState: true },
    };

    jest.spyOn(vitalLens as any, 'processWebcam').mockResolvedValue(mockResult);

    const result = await vitalLens.estimateVitals(mockVideoElement);

    expect(result).toEqual(mockResult);
    expect(vitalLens.estimateVitals).toBeCalledTimes(1);
  });

  it('should process video file and return aggregated vitals', async () => {
    const mockFilePath = './video.mp4';
    const mockResults: VitalLensResult[] = [
      { vitals: { heartRate: 70, respiratoryRate: 16 }, state: { part: 1 } },
      { vitals: { heartRate: 72, respiratoryRate: 17 }, state: { part: 2 } },
    ];

    jest.spyOn(vitalLens as any, 'processVideoFile').mockResolvedValue(mockResults);

    const results = await vitalLens.estimateVitals(mockFilePath);

    expect(results).toEqual(mockResults);
    expect(vitalLens.estimateVitals).toBeCalledTimes(1);
  });

  it('should throw an error for unsupported video source', async () => {
    const unsupportedSource: any = 12345;

    await expect(vitalLens.estimateVitals(unsupportedSource)).rejects.toThrow('Invalid video source');
  });

  it('should handle errors gracefully during processing', async () => {
    const mockFilePath = './video.mp4';

    jest.spyOn(vitalLens as any, 'processVideoFile').mockRejectedValue(new Error('Test Processing Error'));

    await expect(vitalLens.estimateVitals(mockFilePath)).rejects.toThrow('Test Processing Error');
  });
});
