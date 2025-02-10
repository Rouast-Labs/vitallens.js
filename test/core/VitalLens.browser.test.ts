import { VitalLens } from '../../src/core/VitalLens.browser';

jest.mock('../../src/core/VitalLensController.browser', () => ({
  VitalLensController: jest.fn().mockImplementation(() => ({
    setVideoStream: jest.fn(async () => {}),
    startVideoStream: jest.fn(),
    pauseVideoStream: jest.fn(),
    stopVideoStream: jest.fn(),
    processVideoFile: jest.fn(async () => ({
      message: 'Processed file successfully.',
    })),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispose: jest.fn(),
  })),
}));

describe('VitalLens (Browser)', () => {
  let vitalLens: VitalLens;

  beforeEach(() => {
    vitalLens = new VitalLens({ apiKey: 'test-key', method: 'vitallens' });
  });

  describe('setVideoStream', () => {
    test('should call setVideoStream on the controller with MediaStream and HTMLVideoElement', async () => {
      const mockStream = {} as MediaStream;
      const mockVideoElement = document.createElement('video');

      await vitalLens.setVideoStream(mockStream, mockVideoElement);

      expect(vitalLens['controller'].setVideoStream).toHaveBeenCalledWith(
        mockStream,
        mockVideoElement
      );
    });

    test('should throw an error when called without arguments', async () => {
      await expect(vitalLens.setVideoStream()).rejects.toThrow(
        'You must provide either a MediaStream, an HTMLVideoElement, or both.'
      );
    });
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

  test('should process a file successfully', async () => {
    const mockFile = new Blob();
    const result = await vitalLens.processVideoFile(mockFile);

    expect(result).toEqual({ message: 'Processed file successfully.' });
  });

  test('should call addEventListener on the controller', () => {
    vitalLens.addEventListener('vitals', jest.fn());
    expect(vitalLens['controller'].addEventListener).toHaveBeenCalled();
  });

  test('should call removeEventListener on the controller', () => {
    vitalLens.removeEventListener('vitals');
    expect(vitalLens['controller'].removeEventListener).toHaveBeenCalled();
  });

  test('should call dispose on the controller on close', () => {
    vitalLens.close();
    expect(vitalLens['controller'].dispose).toHaveBeenCalled();
  });
});
