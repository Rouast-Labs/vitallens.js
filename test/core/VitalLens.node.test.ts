import { VitalLens } from '../../src/core/VitalLens.node';

jest.mock('../../src/core/VitalLensController.node', () => ({
  VitalLensController: jest.fn().mockImplementation(() => ({
    setVideoStream: jest.fn(async () => {}),
    startVideoStream: jest.fn(),
    pauseVideoStream: jest.fn(),
    stopVideoStream: jest.fn(),
    processVideoFile: jest.fn(async () => ({ message: 'Processed file successfully.' })),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  })),
}));

describe('VitalLens (Node)', () => {
  let vitalLens: VitalLens;

  beforeEach(() => {
    vitalLens = new VitalLens({ apiKey: 'test-key', method: 'vitallens' });
  });

  test('should process a file successfully', async () => {
    const mockFile = new Blob();
    const result = await vitalLens.processVideoFile(mockFile);

    expect(result).toEqual({ message: 'Processed file successfully.' });
  });

  test('should throw an error when setVideoStream is called without arguments', async () => {
    await expect(vitalLens.setVideoStream()).rejects.toThrow(
      'You must provide either a MediaStream, an HTMLVideoElement, or both.'
    );
  });

  test('should call startVideoStream on the controller', () => {
    vitalLens.startVideoStream();
    expect(vitalLens['controller'].startVideoStream).toHaveBeenCalled();
  });

  test('should call pauseVideoStream on the controller', () => {
    vitalLens.pauseVideoStream();
    expect(vitalLens['controller'].pauseVideoStream).toHaveBeenCalled();
  });

  test('should call stopVideoStream on the controller', () => {
    vitalLens.stopVideoStream();
    expect(vitalLens['controller'].stopVideoStream).toHaveBeenCalled();
  });

  test('should call addEventListener on the controller', () => {
    vitalLens.addEventListener('vitals', jest.fn());
    expect(vitalLens['controller'].addEventListener).toHaveBeenCalled();
  });

  test('should call removeEventListener on the controller', () => {
    vitalLens.removeEventListener('vitals');
    expect(vitalLens['controller'].removeEventListener).toHaveBeenCalled();
  });
});
