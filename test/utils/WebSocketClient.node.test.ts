/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { WebSocketClient } from '../../src/utils/WebSocketClient.node';
import WebSocket from 'ws';

jest.mock('ws');

describe('WebSocketClient (Node)', () => {
  let client: WebSocketClient;

  beforeEach(() => {
    jest.resetAllMocks();
    client = new WebSocketClient('test-api-key');
  });

  it('should connect successfully', async () => {
    const mockSocket = {
      on: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
    };

    // Mock WebSocket constructor
    (WebSocket as unknown as jest.Mock).mockImplementation(
      () => mockSocket as any
    );

    const connectPromise = client.connect();

    // Trigger the "open" event
    const openHandler = mockSocket.on.mock.calls.find(
      ([event]) => event === 'open'
    )?.[1];
    openHandler?.();

    await expect(connectPromise).resolves.toBeUndefined();
    expect(client.getIsConnected()).toBe(true);
  });

  it('should handle connection errors', async () => {
    const mockSocket = {
      on: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
    };

    // Mock WebSocket constructor
    (WebSocket as unknown as jest.Mock).mockImplementation(
      () => mockSocket as any
    );

    const connectPromise = client.connect();

    // Trigger the "error" event
    const errorHandler = mockSocket.on.mock.calls.find(
      ([event]) => event === 'error'
    )?.[1];
    errorHandler?.(new Error('Mock error'));

    await expect(connectPromise).rejects.toThrow(
      'WebSocket failed to connect: Mock error'
    );
    expect(client.getIsConnected()).toBe(false);
  });
});
