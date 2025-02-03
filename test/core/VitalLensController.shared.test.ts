import { VitalLensControllerBase } from '../../src/core/VitalLensController.base';
import { BufferManager } from '../../src/processing/BufferManager';
import { StreamProcessor } from '../../src/processing/StreamProcessor';
import { MethodHandlerFactory } from '../../src/methods/MethodHandlerFactory';
import { VitalsEstimateManager } from '../../src/processing/VitalsEstimateManager';
import { VitalLensOptions } from '../../src/types/core';
import { IRestClient } from '../../src/types/IRestClient';
import { IWebSocketClient } from '../../src/types/IWebSocketClient';

jest.mock('../../src/processing/BufferManager');
jest.mock('../../src/processing/StreamProcessor');
jest.mock('../../src/methods/MethodHandler');
jest.mock('../../src/methods/MethodHandlerFactory');
jest.mock('../../src/processing/VitalsEstimateManager');

class TestVitalLensController extends VitalLensControllerBase {
  protected createFrameIteratorFactory() {
    return {
      createStreamFrameIterator: jest.fn(),
      createFileFrameIterator: jest.fn(),
    };
  }
  protected createFaceDetector() {
    return { detect: jest.fn(), run: jest.fn(), load: jest.fn() };
  }
  protected createRestClient(apiKey: string): IRestClient {
    return { sendFrames: jest.fn() };
  }
  protected createWebSocketClient(apiKey: string): IWebSocketClient {
    return { connect: jest.fn(), sendFrames: jest.fn(), getIsConnected: jest.fn(), close: jest.fn() }
  }
}

describe('VitalLensControllerBase', () => {
  let controller: TestVitalLensController;
  const mockOptions: VitalLensOptions = { apiKey: 'test-key', method: 'vitallens', requestMode: 'rest' };
  const mockStreamProcessor = new StreamProcessor(
    mockOptions, {} as any, {} as any, {} as any, {} as any, {} as any, jest.fn(), jest.fn()
  );

  beforeEach(() => {
    // Mock MethodHandlerFactory return value
    (MethodHandlerFactory.createHandler as jest.Mock).mockReturnValue({
      init: jest.fn(),
      cleanup: jest.fn(),
      getReady: jest.fn().mockReturnValue(true),
      process: jest.fn(),
    });
    // Instantiate a new controller
    controller = new TestVitalLensController(mockOptions);
  });

  test('should initialize components in the constructor', () => {
    expect(BufferManager).toHaveBeenCalled();
    expect(VitalsEstimateManager).toHaveBeenCalledWith(expect.any(Object), mockOptions);
    expect(MethodHandlerFactory.createHandler).toHaveBeenCalledWith(mockOptions, expect.any(Object));
  });

  test('should create a MethodHandler with correct dependencies on createMethodHandler', () => {
    // WebSocket
    const optionsWithWebSocket: VitalLensOptions = { apiKey: 'test-key', method: 'vitallens', requestMode: 'websocket' };
    const methodHandlerWithWebSocket = controller['createMethodHandler'](optionsWithWebSocket);
    expect(MethodHandlerFactory.createHandler).toHaveBeenCalledWith(
      optionsWithWebSocket,
      {
        webSocketClient: expect.any(Object),
        restClient: undefined,
      }
    );
    expect(methodHandlerWithWebSocket).toBeDefined();
    // REST
    const optionsWithRest: VitalLensOptions = { apiKey: 'test-key', method: 'vitallens', requestMode: 'rest' };
    const methodHandlerWithRest = controller['createMethodHandler'](optionsWithRest);
    expect(MethodHandlerFactory.createHandler).toHaveBeenCalledWith(
      optionsWithRest,
      {
        webSocketClient: undefined,
        restClient: expect.any(Object),
      }
    );
    expect(methodHandlerWithRest).toBeDefined();
  });
  
  test('should throw an error if method is vitallens and apiKey is missing on createMethodHandler', () => {
    const optionsWithoutApiKey: VitalLensOptions = { method: 'vitallens', requestMode: 'rest' };
    expect(() => controller['createMethodHandler'](optionsWithoutApiKey)).toThrowError(
      /An API key is required/
    );
  });
  
  test('should create a MethodHandler without requiring an apiKey for non-vitallens methods on createMethodHandler', () => {
    const optionsForOtherMethod: VitalLensOptions = { method: 'pos' };
    const methodHandler = controller['createMethodHandler'](optionsForOtherMethod);
    expect(MethodHandlerFactory.createHandler).toHaveBeenCalledWith(
      optionsForOtherMethod,
      {
        webSocketClient: undefined,
        restClient: undefined,
      }
    );
    expect(methodHandler).toBeDefined();
  });
  
  test('should start on startVideoStream if streamProcessor is not null and not already processing', () => {
    controller['streamProcessor'] = mockStreamProcessor as any;
    controller['processing'] = false;
    controller.startVideoStream();
    expect(controller['methodHandler'].init).toHaveBeenCalled();
    expect(mockStreamProcessor.start).toHaveBeenCalled();
  });
  
  test('should not start on startVideoStream if streamProcessor is null or already processing', () => {
    const mockStreamProcessor1 = new StreamProcessor(
      mockOptions, {} as any, {} as any, {} as any, {} as any, {} as any, jest.fn(), jest.fn()
    );
    // Case 1: streamProcessor is null
    controller['streamProcessor'] = null;
    controller.startVideoStream();
    expect(controller['methodHandler'].init).not.toHaveBeenCalled();
    // Case 2: already processing
    controller['streamProcessor'] = mockStreamProcessor1 as StreamProcessor;
    controller['processing'] = true;
    controller.startVideoStream();
    expect(controller['methodHandler'].init).not.toHaveBeenCalled();
    expect(mockStreamProcessor1.start).not.toHaveBeenCalled();
  });

  test('should stop streamProcessor and cleanup methodHandler in pauseVideoStream', () => {
    controller['streamProcessor'] = mockStreamProcessor as any;
    jest.spyOn(mockStreamProcessor, 'stop').mockImplementation(() => {});
    controller['processing'] = true;
    controller.pauseVideoStream();
    expect(mockStreamProcessor.stop).toHaveBeenCalled();
    expect(controller['methodHandler'].cleanup).toHaveBeenCalled();
    expect(controller['processing']).toBe(false);
  });
  
  test('should not stop or cleanup on pauseVideoStream if processing is false', () => {
    const mockStreamProcessor1 = new StreamProcessor(
      mockOptions, {} as any, {} as any, {} as any, {} as any, {} as any, jest.fn(), jest.fn()
    );
    controller['streamProcessor'] = mockStreamProcessor1 as any;
    jest.spyOn(mockStreamProcessor1, 'stop').mockImplementation(() => {});
    controller['processing'] = false;
    controller.pauseVideoStream();
    expect(mockStreamProcessor1.stop).not.toHaveBeenCalled();
    expect(controller['methodHandler'].cleanup).not.toHaveBeenCalled();
    expect(controller['processing']).toBe(false);
  });
  
  test('should do nothing on pauseVideoStream if streamProcessor is null', () => {
    controller['streamProcessor'] = null;
    controller['processing'] = true;
    controller.pauseVideoStream();
    expect(controller['processing']).toBe(true);
    expect(controller['methodHandler'].cleanup).not.toHaveBeenCalled();
  });

  test('should stop the StreamProcessor and clear resources in stopVideoStream', () => {
    const mockStreamProcessor1 = new StreamProcessor(
      mockOptions, {} as any, {} as any, {} as any, {} as any, {} as any, jest.fn(), jest.fn()
    );
    controller['streamProcessor'] = mockStreamProcessor1 as any;
    jest.spyOn(mockStreamProcessor1, 'stop').mockImplementation(() => {});
    controller.stopVideoStream();
    expect(mockStreamProcessor1.stop).toHaveBeenCalled();
    expect(controller['bufferManager'].cleanup).toHaveBeenCalled();
    expect(controller['methodHandler'].cleanup).toHaveBeenCalled();
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

  test('addEventListener should register a listener and trigger it on dispatchEvent', () => {
    const mockListener = jest.fn();
    
    // Register the listener for the 'vitals' event.
    controller.addEventListener('vitals', mockListener);
    
    // Dispatch the event with some data.
    const testData = { heartRate: 75 };
    controller['dispatchEvent']('vitals', testData);
    
    // Verify that the listener was called with the correct data.
    expect(mockListener).toHaveBeenCalledWith(testData);
  });  

  test('should remove all listeners for an event when removeEventListener is called', () => {
    const mockListener1 = jest.fn();
    const mockListener2 = jest.fn();
    controller.addEventListener('vitals', mockListener1);
    controller.addEventListener('vitals', mockListener2);
    
    // Remove all listeners for 'vitals'
    controller.removeEventListener('vitals');
    
    // Dispatching the event should not call any listeners
    controller['dispatchEvent']('vitals', { heartRate: 80 });
    expect(mockListener1).not.toHaveBeenCalled();
    expect(mockListener2).not.toHaveBeenCalled();
  });
  
  test('should do nothing if removeEventListener is called for an event that does not exist', () => {
    // This should not throw an error
    expect(() => controller.removeEventListener('nonexistent')).not.toThrow();
  });
  
  test('should call all registered listeners on dispatchEvent', () => {
    const listener1 = jest.fn();
    const listener2 = jest.fn();
    controller.addEventListener('vitals', listener1);
    controller.addEventListener('vitals', listener2);
    
    // Directly call the private dispatchEvent (or via a public API that triggers it)
    controller['dispatchEvent']('vitals', { heartRate: 88 });
    
    expect(listener1).toHaveBeenCalledWith({ heartRate: 88 });
    expect(listener2).toHaveBeenCalledWith({ heartRate: 88 });
  });
});
