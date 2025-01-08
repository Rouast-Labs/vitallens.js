import { WebSocketClient } from '../../src/utils/WebSocketClient';

jest.mock('ws'); // Mock WebSocket module

describe('WebSocketClient', () => {
  const mockUrl = 'wss://test-websocket.com';
  let webSocketClient: WebSocketClient;
  let mockWebSocket: WebSocket;

  beforeEach(() => {
    mockWebSocket = {
      send: jest.fn(),
      close: jest.fn(),
      onopen: jest.fn(),
      onclose: jest.fn(),
      onerror: jest.fn(),
      onmessage: jest.fn(),
      readyState: WebSocket.OPEN,
    } as unknown as WebSocket;

    jest.spyOn(global, 'WebSocket').mockImplementation(() => mockWebSocket);

    webSocketClient = new WebSocketClient(mockUrl);
  });

  it('should initialize with the correct URL', () => {
    expect(webSocketClient).toBeInstanceOf(WebSocketClient);
    expect(WebSocket).toHaveBeenCalledWith(mockUrl);
  });

  it('should establish a WebSocket connection', () => {
    const onOpenCallback = jest.fn();
    mockWebSocket.onopen = onOpenCallback;

    webSocketClient = new WebSocketClient(mockUrl);
    mockWebSocket.onopen(new Event('open'));

    expect(onOpenCallback).toHaveBeenCalled();
  });

  it('should send a payload and receive a response', async () => {
    const mockPayload = { test: 'data' };
    const mockResponse = { success: true };

    mockWebSocket.send = jest.fn((data) => {
      mockWebSocket.onmessage({ data: JSON.stringify(mockResponse) } as MessageEvent);
    });

    const response = await webSocketClient.send(mockPayload);

    expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(mockPayload));
    expect(response).toEqual(mockResponse);
  });

  it('should throw an error if WebSocket is not connected', async () => {
    mockWebSocket.readyState = WebSocket.CLOSED;

    const mockPayload = { test: 'data' };
    await expect(webSocketClient.send(mockPayload)).rejects.toThrow('WebSocket is not connected');
  });

  it('should throw an error if WebSocket communication fails', async () => {
    const mockPayload = { test: 'data' };
    const mockError = new Error('Test Error');

    mockWebSocket.onerror = (event) => {
      throw mockError;
    };

    await expect(webSocketClient.send(mockPayload)).rejects.toThrow('WebSocket error: Test Error');
  });

  it('should close the WebSocket connection', () => {
    webSocketClient.close();
    expect(mockWebSocket.close).toHaveBeenCalled();
  });
});
