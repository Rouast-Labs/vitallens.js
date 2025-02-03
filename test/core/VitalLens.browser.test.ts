import { VitalLens } from '../../src/core/VitalLens.browser';

jest.mock('../../src/core/VitalLensController.browser', () => ({
  VitalLensController: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    pause: jest.fn(),
    stop: jest.fn(),
    addStream: jest.fn(async () => {}),
    processFile: jest.fn(async () => ({ message: 'Processed file successfully.' })),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  })),
}));

describe('VitalLens (Browser)', () => {
  let vitalLens: VitalLens;

  beforeEach(() => {
    vitalLens = new VitalLens({ apiKey: 'test-key', method: 'vitallens' });
  });

  test('should process a file successfully', async () => {
    const mockFile = new Blob();
    const result = await vitalLens.processVideoFile(mockFile);

    expect(result).toEqual({ message: 'Processed file successfully.' });
  });

  test('should call addStream on the controller with MediaStream and HTMLVideoElement', async () => {
    const mockStream = {} as MediaStream;
    const mockVideoElement = document.createElement('video');

    await vitalLens.addVideoStream(mockStream, mockVideoElement);

    expect(vitalLens['controller'].addStream).toHaveBeenCalledWith(mockStream, mockVideoElement);
  });

  test('should throw an error when addVideoStream is called without arguments', async () => {
    await expect(vitalLens.addVideoStream()).rejects.toThrow(
      'You must provide either a MediaStream, an HTMLVideoElement, or both.'
    );
  });

  test('should call start on the controller', () => {
    vitalLens.startVideoStream();
    expect(vitalLens['controller'].start).toHaveBeenCalled();
  });

  test('should call pause on the controller', () => {
    vitalLens.pauseVideoStream();
    expect(vitalLens['controller'].pause).toHaveBeenCalled();
  });

  test('should call stop on the controller', () => {
    vitalLens.stopVideoStream();
    expect(vitalLens['controller'].stop).toHaveBeenCalled();
  });

  test('should call addEventListener on the controller', () => {
    vitalLens.addEventListener('vitals', jest.fn());
    expect(vitalLens['controller'].addEventListener).toHaveBeenCalled();
  });

  test('should call stop on the controller', () => {
    vitalLens.removeEventListener('vitals');
    expect(vitalLens['controller'].removeEventListener).toHaveBeenCalled();
  });
});
