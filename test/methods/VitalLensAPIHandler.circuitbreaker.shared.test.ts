import { VitalLensAPIHandler } from '../../src/methods/VitalLensAPIHandler';
import { IRestClient, ResolveModelResponse } from '../../src/types/IRestClient';
import { VitalLensOptions, VitalLensResult } from '../../src/types/core';
import { Frame } from '../../src/processing/Frame';
import { jest } from '@jest/globals';
import { VitalLensAPIError } from '../../src/utils/errors';

// A standard successful response from the API for our mocks
const mockSuccessResponseBody: VitalLensResult = {
  vital_signs: {
    ppg_waveform: {
      data: [1, 2, 3],
      confidence: [1, 1, 1],
      note: '',
      unit: '',
    },
    respiratory_waveform: {
      data: [4, 5, 6],
      confidence: [1, 1, 1],
      note: '',
      unit: '',
    },
  },
  face: { confidence: [1], coordinates: [[0, 0, 10, 10]], note: '' },
  state: { data: new Float32Array([1, 0, 0]), note: '' },
  time: [1000, 1001, 1002],
  message: 'Success from fallback',
};

// Mock the RestClient's methods
const mockRestClient: jest.Mocked<IRestClient> = {
  sendFrames: jest.fn(),
  resolveModel: jest.fn(
    async () =>
      ({
        resolved_model: 'vitallens-2.0',
        config: {
          n_inputs: 5,
          input_size: 40,
          fps_target: 30,
          roi_method: 'face',
          supported_vitals: ['hr', 'rr'],
        },
      }) as ResolveModelResponse
  ),
};

// Create a mock frame to pass to the handler
const mockFrame = new Frame({
  rawData: new Uint8Array([1, 2, 3]).buffer,
  shape: [1, 1, 3],
  dtype: 'uint8',
  timestamp: [1, 2, 3],
  roi: [{ x0: 0, y0: 0, x1: 10, y1: 10 }],
});

describe('VitalLensAPIHandler Circuit Breaker', () => {
  let handler: VitalLensAPIHandler;
  const mockOptions: VitalLensOptions = {
    apiKey: 'test-key',
    method: 'vitallens',
    requestMode: 'rest',
  };
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Suppress console logs for these tests as errors/warnings are expected
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    handler = new VitalLensAPIHandler(mockRestClient, mockOptions);
    await handler.init();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('should use the /stream endpoint under normal conditions', async () => {
    // ARRANGE: Mock the client to succeed on the /stream endpoint
    mockRestClient.sendFrames.mockResolvedValue({
      statusCode: 200,
      body: mockSuccessResponseBody,
    });

    // ACT: Process with a small buffer size
    await handler.process(mockFrame, 'stream', undefined, 50);

    // ASSERT: The /stream endpoint should be called
    expect(mockRestClient.sendFrames).toHaveBeenCalledTimes(1);
    expect(mockRestClient.sendFrames).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Uint8Array),
      'stream',
      undefined
    );
  });

  it('should throw a reset error if buffer size exceeds STREAM_RESET_BUFFER_THRESHOLD', async () => {
    // ACT & ASSERT: Process with a buffer size (101) that triggers the hard reset limit (100).
    // This should throw an error before any API call is made.
    await expect(
      handler.process(mockFrame, 'stream', undefined, 101)
    ).rejects.toThrow(
      'Network instability detected. Frame buffer exceeded 100 frames. Resetting stream.'
    );
    expect(mockRestClient.sendFrames).not.toHaveBeenCalled();
  });

  it('should throw a general VitalLensAPIError on fetch timeout', async () => {
    // ARRANGE: Mock the client to simulate a network timeout.
    mockRestClient.sendFrames.mockRejectedValue(new Error('Request timed out'));

    // ACT & ASSERT: Expect the process method to catch the timeout and re-throw it as a VitalLensAPIError.
    await expect(
      handler.process(mockFrame, 'stream', undefined, 50)
    ).rejects.toThrow(VitalLensAPIError);

    // Ensure it contains the original message.
    await expect(
      handler.process(mockFrame, 'stream', undefined, 50)
    ).rejects.toThrow('Request timed out');
  });
});
