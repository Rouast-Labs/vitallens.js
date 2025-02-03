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

  test('should create a MethodHandler with correct dependencies on createMethodHandler()', () => {
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
  
  test('should throw an error if method is vitallens and apiKey is missing on createMethodHandler()', () => {
    const optionsWithoutApiKey: VitalLensOptions = { method: 'vitallens', requestMode: 'rest' };
    expect(() => controller['createMethodHandler'](optionsWithoutApiKey)).toThrowError(
      /An API key is required/
    );
  });
  
  test('should create a MethodHandler without requiring an apiKey for non-vitallens methods on createMethodHandler()', () => {
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

  // TODO: Test that addStream throws error if called in node
  // TODO: Tests for processFile
  
  test('should start on startVideoStream() if streamProcessor is not null and not already processing', () => {
    controller['streamProcessor'] = mockStreamProcessor as any;
    controller['processing'] = false;
    controller.startVideoStream();
    expect(controller['methodHandler'].init).toHaveBeenCalled();
    expect(mockStreamProcessor.start).toHaveBeenCalled();
  });
  
  test('should not start on startVideoStream() if streamProcessor is null or already processing', () => {
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

  test('should stop streamProcessor and cleanup methodHandler in pauseVideoStream()', () => {
    controller['streamProcessor'] = mockStreamProcessor as any;
    jest.spyOn(mockStreamProcessor, 'stop').mockImplementation(() => {});
    controller['processing'] = true;
    controller.pauseVideoStream();
    expect(mockStreamProcessor.stop).toHaveBeenCalled();
    expect(controller['methodHandler'].cleanup).toHaveBeenCalled();
    expect(controller['processing']).toBe(false);
  });
  
  test('should not stop or cleanup on pauseVideoStream() if processing is false', () => {
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
  
  test('should do nothing on pauseVideoStream() if streamProcessor is null', () => {
    controller['streamProcessor'] = null;
    controller['processing'] = true;
    controller.pauseVideoStream();
    expect(controller['processing']).toBe(true);
    expect(controller['methodHandler'].cleanup).not.toHaveBeenCalled();
  });

  test('should stop the StreamProcessor and clear resources in stopVideoStream()', () => {
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

  test('should add event listeners and trigger them on dispatchEvent()', () => {
    const mockListener = jest.fn();
    controller.addEventListener('vitals', mockListener);
    controller['dispatchEvent']('vitals', { heartRate: 75 });
    expect(mockListener).toHaveBeenCalledWith({ heartRate: 75 });
  });
  
});
