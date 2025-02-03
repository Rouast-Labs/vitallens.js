import { VitalLensController } from '../../src/core/VitalLensController.node';
import { FrameIteratorFactory } from '../../src/processing/FrameIteratorFactory.node';
import { FaceDetectorAsync } from '../../src/ssd/FaceDetectorAsync.node';
import { VitalLensOptions } from '../../src/types/core';

jest.mock('../../src/processing/FrameIteratorFactory.node');
jest.mock('../../src/ssd/FaceDetectorAsync.node');

describe('VitalLensController (Node)', () => {
  let controller: VitalLensController;
  const mockOptions: VitalLensOptions = { apiKey: 'test-key', method: 'vitallens', requestMode: 'rest' };

  beforeEach(() => {
    // Instantiate a new controller for each test
    controller = new VitalLensController(mockOptions);
  });

  test('should create a Node FrameIteratorFactory instance in constructor', () => {
    expect(FrameIteratorFactory).toHaveBeenCalledWith(mockOptions);
  });

  test('should create a Node FaceDetectorAsync instance in constructor', () => {
    expect(FaceDetectorAsync).toHaveBeenCalled();
  });

  test('should throw an error if setVideoStream is called in Node environment', async () => {
    const mockStream = {} as MediaStream;
    const mockVideoElement = {} as HTMLVideoElement;
    await expect(controller.setVideoStream(mockStream, mockVideoElement)).rejects.toThrowError(
      'setVideoStream is not supported yet in the Node environment.'
    );
  });
});
