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
  
  test('should call createFileFrameIterator and processVideoFile correctly', async () => {
    const mockFileInput = 'path/to/video/file.mp4';

    // Mock frame iterator
    const mockFrameIterator = {
      start: jest.fn(),
      stop: jest.fn(),
      getId: jest.fn().mockReturnValue('frameIteratorId'),
      [Symbol.asyncIterator]: jest.fn().mockReturnValue((async function* () {
        yield { frames: [new Uint8Array([1, 2, 3])], timestamp: 0 }; // Simulated frame chunk
        yield { frames: [new Uint8Array([4, 5, 6])], timestamp: 1 }; // Another frame chunk
      })()),
    };

    // Mock dependencies
    controller['frameIteratorFactory']!.createFileFrameIterator = jest
      .fn()
      .mockReturnValue(mockFrameIterator);

    const mockIncrementalResult = { some: 'incremental data' };
    controller['methodHandler'].process = jest.fn().mockResolvedValue(mockIncrementalResult);
    controller['methodHandler'].init = jest.fn();
    controller['methodHandler'].cleanup = jest.fn();

    controller['vitalsEstimateManager'].processIncrementalResult = jest.fn().mockResolvedValue({});
    const mockFinalResult = { message: 'Processing complete' };
    controller['vitalsEstimateManager'].getResult = jest.fn().mockResolvedValue(mockFinalResult);

    // Run processFile
    const result = await controller.processVideoFile(mockFileInput);

    // Verify createFileFrameIterator was called
    expect(controller['frameIteratorFactory']!.createFileFrameIterator).toHaveBeenCalledWith(
      mockFileInput,
      controller['methodConfig'],
      controller['faceDetector']
    );

    // Ensure dependencies are initialized
    expect(controller['faceDetector'].load).toHaveBeenCalled();
    expect(controller['methodHandler'].init).toHaveBeenCalled();

    // Ensure frameIterator started processing
    expect(mockFrameIterator.start).toHaveBeenCalled();

    // Ensure process was called for each frame chunk
    expect(controller['methodHandler'].process).toHaveBeenCalledTimes(2);
    expect(controller['methodHandler'].process).toHaveBeenCalledWith(
      { frames: [new Uint8Array([1, 2, 3])], timestamp: 0 },
      controller['bufferManager'].getState()
    );
    expect(controller['methodHandler'].process).toHaveBeenCalledWith(
      { frames: [new Uint8Array([4, 5, 6])], timestamp: 1 },
      controller['bufferManager'].getState()
    );

    // Ensure vitalsEstimateManager processes incremental results
    expect(controller['vitalsEstimateManager'].processIncrementalResult).toHaveBeenCalledTimes(2);
    expect(controller['vitalsEstimateManager'].processIncrementalResult).toHaveBeenCalledWith(
      mockIncrementalResult,
      'frameIteratorId',
      'complete'
    );

    // Ensure final cleanup is called
    expect(controller['methodHandler'].cleanup).toHaveBeenCalled();

    // Verify final result
    expect(result).toEqual(mockFinalResult);
  });
});
