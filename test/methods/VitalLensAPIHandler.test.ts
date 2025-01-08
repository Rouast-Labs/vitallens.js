import { VitalLensAPIHandler } from '../../src/methods/VitalLensAPIHandler';
import { VitalLensOptions, Frame, VitalLensResult } from '../../src/types/core';
import { WebSocketClient } from '../../src/utils/WebSocketClient';

jest.mock('../../src/utils/WebSocketClient');

describe('VitalLensAPIHandler', () => {
  const mockOptions: VitalLensOptions = {
    method: 'vitallens',
    fps: 30,
    roi: { x: 50, y: 50, width: 200, height: 200 },
    apiEndpoint: 'wss://api.vitallens.com',
  };

  const mockFrames: Frame[] = [
    { data: 'frame1-data', timestamp: 1 },
    { data: 'frame2-data', timestamp: 2 },
  ];

  let apiHandler: VitalLensAPIHandler;
  let mockWebSocketClient: jest.Mocked<WebSocketClient>;

  beforeEach(() => {
    mockWebSocketClient = new WebSocketClient(mockOptions.apiEndpoint) as jest.Mocked<WebSocketClient>;
    apiHandler = new VitalLensAPIHandler(mockOptions);
    (apiHandler as any).webSocketClient = mockWebSocketClient;
  });

  it('should initialize with correct options', () => {
    expect(apiHandler).toBeInstanceOf(VitalLensAPIHandler);
  });

  it('should send frames to the WebSocket API and return results', async () => {
    const mockResponse: VitalLensResult = {
      vitals: { heartRate: 75, respiratoryRate: 16 },
      state: { mockState: true },
    };

    mockWebSocketClient.send.mockResolvedValueOnce(mockResponse);

    const result = await apiHandler.process(mockFrames);

    expect(mockWebSocketClient.send).toHaveBeenCalledWith({
      frames: 'frame1-data,frame2-data',
      state: undefined,
    });
    expect(result).toEqual(mockResponse);
  });

  it('should include state in the payload if provided', async () => {
    const mockState = { mockState: true };
    const mockResponse: VitalLensResult = {
      vitals: { heartRate: 80 },
      state: { mockState: true },
    };

    mockWebSocketClient.send.mockResolvedValueOnce(mockResponse);

    const result = await apiHandler.process(mockFrames, mockState);

    expect(mockWebSocketClient.send).toHaveBeenCalledWith({
      frames: 'frame1-data,frame2-data',
      state: mockState,
    });
    expect(result).toEqual(mockResponse);
  });

  it('should throw an error if WebSocket communication fails', async () => {
    mockWebSocketClient.send.mockRejectedValueOnce(new Error('WebSocket error'));

    await expect(apiHandler.process(mockFrames)).rejects.toThrow('VitalLens API error: WebSocket error');
  });
});
