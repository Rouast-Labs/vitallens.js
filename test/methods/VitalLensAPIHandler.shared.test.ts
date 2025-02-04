import { VitalLensAPIHandler } from '../../src/methods/VitalLensAPIHandler';
import { IWebSocketClient } from '../../src/types/IWebSocketClient';
import { IRestClient } from '../../src/types/IRestClient';
import { VitalLensAPIResponse, VitalLensOptions } from '../../src/types/core';
import { Frame } from '../../src/processing/Frame';
import {
  VitalLensAPIError,
  VitalLensAPIKeyError,
  VitalLensAPIQuotaExceededError,
} from '../../src/utils/errors';
import { jest } from '@jest/globals';

// Mock implementations
const mockWebSocketClient: Partial<IWebSocketClient> = {
  connect: jest.fn<() => Promise<void>>(),
  close: jest.fn<() => void>(),
  getIsConnected: jest.fn<() => boolean>().mockReturnValue(true),
  sendFrames:
    jest.fn<
      (
        metadata: Record<string, unknown>,
        frames: Uint8Array,
        state?: Float32Array
      ) => Promise<VitalLensAPIResponse>
    >(),
};

const mockResponse: VitalLensAPIResponse = {
  statusCode: 200,
  body: {
    vital_signs: {
      ppg_waveform: {
        data: [1, 2, 3],
        confidence: [0.9, 0.9, 0.9],
        note: '',
        unit: '',
      },
      respiratory_waveform: {
        data: [1, 2, 3],
        confidence: [0.9, 0.9, 0.9],
        note: '',
        unit: '',
      },
    },
    face: { confidence: [0.9, 0.95, 0.85], coordinates: [], note: '' },
    state: { data: new Float32Array([1, 0, 0]), note: '' },
    time: [1000, 1001, 1002],
    message: '',
  },
};

const mockRestClient: Partial<IRestClient> = {
  sendFrames:
    jest.fn<
      (
        metadata: Record<string, unknown>,
        frames: Uint8Array,
        state?: Float32Array
      ) => Promise<VitalLensAPIResponse>
    >(),
};

describe('VitalLensAPIHandler', () => {
  const mockOptionsREST: VitalLensOptions = {
    apiKey: 'test-key',
    method: 'vitallens',
    requestMode: 'rest',
  };
  const mockOptionsWS: VitalLensOptions = {
    apiKey: 'test-key',
    method: 'vitallens',
    requestMode: 'websocket',
  };
  const mockFrame = {
    getUint8Array: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
    getROI: jest.fn().mockReturnValue([
      { x0: 0, y0: 0, x1: 10, y1: 10 },
      { x0: 0, y0: 0, x1: 10, y1: 10 },
      { x0: 0, y0: 0, x1: 10, y1: 10 },
    ]),
    getTimestamp: jest.fn().mockReturnValue([0, 1, 2]),
  } as unknown as Frame;

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize and connect a WebSocket client', async () => {
    const handler = new VitalLensAPIHandler(
      mockWebSocketClient as IWebSocketClient,
      mockOptionsWS
    );
    await handler.init();
    expect(mockWebSocketClient.connect).toHaveBeenCalled();
  });

  it('should clean up and close a WebSocket client', async () => {
    const handler = new VitalLensAPIHandler(
      mockWebSocketClient as IWebSocketClient,
      mockOptionsWS
    );
    await handler.cleanup();
    expect(mockWebSocketClient.close).toHaveBeenCalled();
  });

  it('should return true if WebSocket client is connected', () => {
    const handler = new VitalLensAPIHandler(
      mockWebSocketClient as IWebSocketClient,
      mockOptionsWS
    );
    expect(handler.getReady()).toBe(true);
  });

  it('should return true for REST client readiness', () => {
    const handler = new VitalLensAPIHandler(
      mockRestClient as IRestClient,
      mockOptionsREST
    );
    expect(handler.getReady()).toBe(true);
  });

  it('should process frames and return a valid result for WebSocket client', async () => {
    mockWebSocketClient.sendFrames = jest
      .fn<
        (
          metadata: Record<string, unknown>,
          frames: Uint8Array,
          state?: Float32Array
        ) => Promise<VitalLensAPIResponse>
      >()
      .mockResolvedValue(mockResponse);

    const handler = new VitalLensAPIHandler(
      mockWebSocketClient as IWebSocketClient,
      mockOptionsWS
    );
    const result = await handler.process(mockFrame);

    expect(result).toEqual({
      face: {
        coordinates: [
          [0, 0, 10, 10],
          [0, 0, 10, 10],
          [0, 0, 10, 10],
        ],
        confidence: mockResponse.body.face.confidence,
        note: 'Face detection coordinates for this face, along with live confidence levels.',
      },
      vital_signs: mockResponse.body.vital_signs,
      state: mockResponse.body.state,
      time: mockFrame.getTimestamp(),
      message:
        'The provided values are estimates and should be interpreted according to the provided confidence levels ranging from 0 to 1. The VitalLens API is not a medical device and its estimates are not intended for any medical purposes.',
    });
    expect(mockWebSocketClient.sendFrames).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Uint8Array),
      undefined
    );
  });

  it('should throw an error for invalid response format', async () => {
    mockWebSocketClient.sendFrames = jest
      .fn<
        (
          metadata: Record<string, unknown>,
          frames: Uint8Array,
          state?: Float32Array
        ) => Promise<VitalLensAPIResponse>
      >()
      .mockResolvedValue({
        statusCode: 1234,
        body: { face: {}, vital_signs: {}, time: [], message: '' },
      });

    const handler = new VitalLensAPIHandler(
      mockWebSocketClient as IWebSocketClient,
      mockOptionsWS
    );
    await expect(handler.process(mockFrame)).rejects.toThrow(VitalLensAPIError);
  });

  it('should handle API key errors', async () => {
    const mockErrorResponse: VitalLensAPIResponse = {
      statusCode: 403,
      body: { face: {}, vital_signs: {}, time: [], message: 'Invalid API Key' },
    };
    mockWebSocketClient.sendFrames = jest
      .fn<
        (
          metadata: Record<string, unknown>,
          frames: Uint8Array,
          state?: Float32Array
        ) => Promise<VitalLensAPIResponse>
      >()
      .mockResolvedValue(mockErrorResponse);
    const handler = new VitalLensAPIHandler(
      mockWebSocketClient as IWebSocketClient,
      mockOptionsWS
    );
    await expect(handler.process(mockFrame)).rejects.toThrow(
      VitalLensAPIKeyError
    );
  });

  it('should handle quota exceeded errors', async () => {
    const mockErrorResponse = {
      statusCode: 429,
      body: { face: {}, vital_signs: {}, time: [], message: 'Quota exceeded' },
    };
    mockWebSocketClient.sendFrames = jest
      .fn<
        (
          metadata: Record<string, unknown>,
          frames: Uint8Array,
          state?: Float32Array
        ) => Promise<VitalLensAPIResponse>
      >()
      .mockResolvedValue(mockErrorResponse);
    const handler = new VitalLensAPIHandler(
      mockWebSocketClient as IWebSocketClient,
      mockOptionsWS
    );
    await expect(handler.process(mockFrame)).rejects.toThrow(
      VitalLensAPIQuotaExceededError
    );
  });
});
