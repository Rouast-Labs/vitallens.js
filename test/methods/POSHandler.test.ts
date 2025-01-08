import { POSHandler } from '../../src/methods/POSHandler';
import { VitalLensOptions, Frame, VitalLensResult } from '../../src/types/core';

describe('POSHandler', () => {
  const mockOptions: VitalLensOptions = {
    method: 'pos',
    fps: 30,
    roi: { x: 50, y: 50, width: 200, height: 200 },
  };

  const mockFrames: Frame[] = [
    { data: 'frame1-data', timestamp: 1 },
    { data: 'frame2-data', timestamp: 2 },
    { data: 'frame3-data', timestamp: 3 },
  ];

  let posHandler: POSHandler;

  beforeEach(() => {
    posHandler = new POSHandler(mockOptions);
  });

  it('should initialize with correct options', () => {
    expect(posHandler).toBeInstanceOf(POSHandler);
  });

  it('should throw an error if insufficient frames are provided', async () => {
    const incompleteFrames = mockFrames.slice(0, 2); // Less than required for processing

    await expect(posHandler.process(incompleteFrames)).rejects.toThrow(
      'Insufficient data to apply POS algorithm.'
    );
  });

  it('should process frames and return vitals', async () => {
    const processSpy = jest.spyOn(posHandler as any, 'computePOS').mockReturnValue({
      heartRate: 75,
    });

    const result: VitalLensResult = await posHandler.process(mockFrames);

    expect(processSpy).toHaveBeenCalled();
    expect(result.vitals.heartRate).toBe(75);
  });

  it('should update the signal buffer with extracted RGB values', async () => {
    const mockExtractRGBSignal = jest.spyOn(posHandler as any, 'extractRGBSignal');
    await posHandler.process(mockFrames);

    expect(mockExtractRGBSignal).toHaveBeenCalledTimes(mockFrames.length);
    expect(mockExtractRGBSignal).toHaveBeenCalledWith('frame1-data');
    expect(mockExtractRGBSignal).toHaveBeenCalledWith('frame2-data');
    expect(mockExtractRGBSignal).toHaveBeenCalledWith('frame3-data');
  });

  it('should handle errors during processing', async () => {
    jest.spyOn(posHandler as any, 'computePOS').mockImplementation(() => {
      throw new Error('Test Error');
    });

    await expect(posHandler.process(mockFrames)).rejects.toThrow('Test Error');
  });
});
