import { VitalLensAPIHandler } from '../../src/methods/VitalLensAPIHandler';
import { IRestClient, ResolveModelResponse } from '../../src/types/IRestClient';
import {
  InferenceMode,
  VitalLensAPIResponse,
  VitalLensOptions,
} from '../../src/types/core';
import { Frame } from '../../src/processing/Frame';
import {
  VitalLensAPIError,
  VitalLensAPIKeyError,
  VitalLensAPIQuotaExceededError,
} from '../../src/utils/errors';
import { describe, expect, vi, afterEach, it } from 'vitest';

const mockResponse: VitalLensAPIResponse = {
  statusCode: 200,
  body: {
    vitals: {},
    waveforms: {
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
    n: 3,
    model_used: '',
    message: '',
  },
};

const mockRestClient: Partial<IRestClient> = {
  sendFrames:
    vi.fn<
      (
        metadata: Record<string, unknown>,
        frames: Uint8Array,
        mode: InferenceMode,
        state?: Float32Array
      ) => Promise<VitalLensAPIResponse>
    >(),
  resolveModel: vi.fn(
    async () =>
      ({
        resolved_model: 'vitalens-2.0',
        config: {
          n_inputs: 5,
          input_size: 40,
          fps_target: 30,
          roi_method: 'upper_body_cropped',
          supported_vitals: ['hr', 'rr', 'hrv_sdnn', 'hrv_rmssd', 'hrv_lfhf'],
        },
      }) as ResolveModelResponse
  ),
};

describe('VitalLensAPIHandler', () => {
  const mockOptionsREST: VitalLensOptions = {
    apiKey: 'test-key',
    method: 'vitallens',
    requestMode: 'rest',
  };
  const mockFrame = {
    getUint8Array: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
    getROI: vi.fn().mockReturnValue([
      { x0: 0, y0: 0, x1: 10, y1: 10 },
      { x0: 0, y0: 0, x1: 10, y1: 10 },
      { x0: 0, y0: 0, x1: 10, y1: 10 },
    ]),
    getTimestamp: vi.fn().mockReturnValue([0, 1, 2]),
  } as unknown as Frame;

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should behave correctly for REST client readiness', () => {
    const handler = new VitalLensAPIHandler(
      mockRestClient as IRestClient,
      mockOptionsREST
    );
    expect(handler.getReady()).toBe(false);
    handler.init().then(() => {
      expect(handler.getReady()).toBe(true);
    });
  });

  it('should process frames and return a valid result for REST client', async () => {
    mockRestClient.sendFrames = vi
      .fn<
        (
          metadata: Record<string, unknown>,
          frames: Uint8Array,
          mode: InferenceMode,
          state?: Float32Array
        ) => Promise<VitalLensAPIResponse>
      >()
      .mockResolvedValue(mockResponse);

    const handler = new VitalLensAPIHandler(
      mockRestClient as IRestClient,
      mockOptionsREST
    );
    await handler.init();
    const result = await handler.process(mockFrame, 'file');

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
      vitals: mockResponse.body.vitals,
      waveforms: mockResponse.body.waveforms,
      state: mockResponse.body.state,
      time: mockFrame.getTimestamp(),
      n: mockResponse.body.n,
      model_used: mockResponse.body.model_used,
      message:
        'The provided values are estimates and should be interpreted according to the provided confidence levels ranging from 0 to 1. The VitalLens API is not a medical device and its estimates are not intended for any medical purposes.',
    });
    expect(mockRestClient.sendFrames).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Uint8Array),
      'file',
      undefined
    );
  });

  it('should throw an error for invalid response format', async () => {
    mockRestClient.sendFrames = vi
      .fn<
        (
          metadata: Record<string, unknown>,
          frames: Uint8Array,
          mode: InferenceMode,
          state?: Float32Array
        ) => Promise<VitalLensAPIResponse>
      >()
      .mockResolvedValue({
        statusCode: 1234,
        body: { face: {}, vitals: {}, waveforms: {}, time: [], message: '' },
      });

    const handler = new VitalLensAPIHandler(
      mockRestClient as IRestClient,
      mockOptionsREST
    );
    await handler.init();
    await expect(handler.process(mockFrame, 'file')).rejects.toThrow(
      VitalLensAPIError
    );
  });

  it('should handle API key errors', async () => {
    const mockErrorResponse: VitalLensAPIResponse = {
      statusCode: 403,
      body: { face: {}, vitals: {}, waveforms: {}, time: [], message: 'Invalid API Key' },
    };
    mockRestClient.sendFrames = vi
      .fn<
        (
          metadata: Record<string, unknown>,
          frames: Uint8Array,
          mode: InferenceMode,
          state?: Float32Array
        ) => Promise<VitalLensAPIResponse>
      >()
      .mockResolvedValue(mockErrorResponse);
    const handler = new VitalLensAPIHandler(
      mockRestClient as IRestClient,
      mockOptionsREST
    );
    await handler.init();
    await expect(handler.process(mockFrame, 'file')).rejects.toThrow(
      VitalLensAPIKeyError
    );
  });

  it('should handle quota exceeded errors', async () => {
    const mockErrorResponse = {
      statusCode: 429,
      body: { face: {}, vitals: {}, waveforms: {}, time: [], message: 'Quota exceeded' },
    };
    mockRestClient.sendFrames = vi
      .fn<
        (
          metadata: Record<string, unknown>,
          frames: Uint8Array,
          mode: InferenceMode,
          state?: Float32Array
        ) => Promise<VitalLensAPIResponse>
      >()
      .mockResolvedValue(mockErrorResponse);
    const handler = new VitalLensAPIHandler(
      mockRestClient as IRestClient,
      mockOptionsREST
    );
    await handler.init();
    await expect(handler.process(mockFrame, 'file')).rejects.toThrow(
      VitalLensAPIQuotaExceededError
    );
  });
});
