import { VitalLensAPIHandler } from '../../src/methods/VitalLensAPIHandler';
import { IRestClient, ResolveModelResponse } from '../../src/types/IRestClient';
import { VitalLensOptions, VitalLensResult } from '../../src/types/core';
import { Frame } from '../../src/processing/Frame';
import { jest } from '@jest/globals';

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

    // ACT: Process with a small buffer size and no prior errors
    await handler.process(mockFrame, 'stream', undefined, 50);

    // ASSERT: The /stream endpoint should be called, and only once.
    expect(mockRestClient.sendFrames).toHaveBeenCalledTimes(1);
    expect(mockRestClient.sendFrames).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Uint8Array),
      'stream',
      undefined
    );
  });

  it('should switch to the /file endpoint when buffer size exceeds FALLBACK_BUFFER_THRESHOLD', async () => {
    // ARRANGE: Mock the client to succeed on the /file endpoint
    mockRestClient.sendFrames.mockResolvedValue({
      statusCode: 200,
      body: mockSuccessResponseBody,
    });

    // ACT: Process with a large buffer size (101 > 100)
    const result = await handler.process(mockFrame, 'stream', undefined, 101);

    // ASSERT: The /file endpoint should be called directly, and only once.
    expect(result?.message).toBe(
      'The provided values are estimates and should be interpreted according to the provided confidence levels ranging from 0 to 1. The VitalLens API is not a medical device and its estimates are not intended for any medical purposes.'
    );
    expect(mockRestClient.sendFrames).toHaveBeenCalledTimes(1);
    expect(mockRestClient.sendFrames).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Uint8Array),
      'file',
      undefined
    );
  });

  it('should switch to the /file endpoint after a timeout', async () => {
    // ARRANGE: Mock the client to fail on '/stream' but succeed on '/file'
    mockRestClient.sendFrames.mockImplementation(
      async (metadata, frames, mode) => {
        if (mode === 'stream') {
          throw new Error('Request timed out');
        }
        if (mode === 'file') {
          return Promise.resolve({
            statusCode: 200,
            body: mockSuccessResponseBody,
          });
        }
        return Promise.reject(new Error(`Unexpected mode in mock: ${mode}`));
      }
    );

    // ACT: Process the frame. The initial call will be to '/stream'.
    const result = await handler.process(mockFrame, 'stream', undefined, 50);

    // ASSERT
    expect(result?.message).toBe(
      'The provided values are estimates and should be interpreted according to the provided confidence levels ranging from 0 to 1. The VitalLens API is not a medical device and its estimates are not intended for any medical purposes.'
    );
    expect(mockRestClient.sendFrames).toHaveBeenCalledTimes(2);
    expect(mockRestClient.sendFrames).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Uint8Array),
      'stream',
      undefined
    );
    expect(mockRestClient.sendFrames).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Uint8Array),
      'file',
      undefined
    );
  });

  it('should reset the timeout counter after a successful fallback', async () => {
    // ARRANGE: Set the initial timeout count to 1 to force a fallback
    (handler as any).consecutiveTimeouts = 1;
    mockRestClient.sendFrames.mockResolvedValue({
      statusCode: 200,
      body: mockSuccessResponseBody,
    });

    // ACT: Process the frame. This will go straight to the /file fallback due to the counter.
    await handler.process(mockFrame, 'stream', undefined, 50);

    // ASSERT: The fallback call should be successful, and the counter should be reset.
    expect(mockRestClient.sendFrames).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Uint8Array),
      'file',
      undefined
    );
    expect((handler as any).consecutiveTimeouts).toBe(0);
  });

  it('should throw a reset error if buffer size exceeds RESET_BUFFER_THRESHOLD', async () => {
    // ACT & ASSERT: Process with a buffer size (301) that triggers the hard reset limit (300).
    // This should throw an error before any API call is made.
    await expect(
      handler.process(mockFrame, 'stream', undefined, 301)
    ).rejects.toThrow(
      'Network instability detected. Frame buffer exceeded 300 frames. Resetting stream.'
    );
    expect(mockRestClient.sendFrames).not.toHaveBeenCalled();
  });

  it('should throw a reset error after MAX_CONSECUTIVE_TIMEOUTS', async () => {
    // ARRANGE: Mock the client to *always* throw a timeout error
    mockRestClient.sendFrames.mockImplementation(
      async (metadata, frames, mode) => {
        throw new Error('Request timed out');
      }
    );

    // ACT & ASSERT
    // Call 1: /stream fails (timeout #1), then the immediate fallback to /file fails (timeout #2).
    // The handler returns undefined because the max has not been reached.
    const result1 = await handler.process(mockFrame, 'stream', undefined, 50);
    expect(result1).toBeUndefined();
    expect((handler as any).consecutiveTimeouts).toBe(2);

    // Call 2: Since consecutiveTimeouts > 0, it goes straight to the /file fallback.
    // The fallback fails again (timeout #3). This time, it should throw the final error.
    await expect(
      handler.process(mockFrame, 'stream', undefined, 50)
    ).rejects.toThrow(
      'Persistent network instability. Please check your connection. Resetting stream.'
    );

    // Verify the final timeout count
    expect((handler as any).consecutiveTimeouts).toBe(3);
  });
});
