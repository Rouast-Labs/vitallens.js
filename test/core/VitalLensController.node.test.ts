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

  test('should throw an error if addStream is called in Node environment', async () => {
    const mockStream = {} as MediaStream;
    const mockVideoElement = {} as HTMLVideoElement;
    await expect(controller.addStream(mockStream, mockVideoElement)).rejects.toThrowError(
      'addStream is not supported yet in the Node environment.'
    );
  });
  

  // TODO
  // test('should call createFileFrameIterator and processFile correctly', async () => {
  //   const mockFileInput = 'path/to/video/file.mp4';
  //   const mockFrameIterator = {
  //     start: jest.fn(),
  //     stop: jest.fn(),
  //     [Symbol.asyncIterator]: jest.fn().mockReturnValue({
  //       next: jest.fn().mockResolvedValue({ value: null, done: true }),
  //     }),
  //   };

  //   // Mock the createFileFrameIterator method
  //   controller['frameIteratorFactory']!.createFileFrameIterator = jest
  //     .fn()
  //     .mockReturnValue(mockFrameIterator);

  //   const mockResult = { message: 'Processing complete' };
  //   controller['vitalsEstimateManager'].getResult = jest.fn().mockResolvedValue(mockResult);

  //   const result = await controller.processFile(mockFileInput);

  //   // Verify createFileFrameIterator was called
  //   expect(controller['frameIteratorFactory']!.createFileFrameIterator).toHaveBeenCalledWith(
  //     mockFileInput,
  //     controller['methodConfig'],
  //     controller['faceDetector']
  //   );

  //   // Verify that the correct result is returned
  //   expect(result).toEqual(mockResult);
  // });
});
