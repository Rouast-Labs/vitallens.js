import { WebSocketClient } from "../../src/utils/WebSocketClient.browser";

describe("WebSocketClient (Browser)", () => {
  let client: WebSocketClient;

  beforeEach(() => {
    jest.resetAllMocks();
    client = new WebSocketClient("test-api-key");
  });

  it("should connect successfully", async () => {
    // Mock the WebSocket implementation
    global.WebSocket = jest.fn().mockImplementation(() => ({
      onopen: null,
      onerror: null,
      onclose: null,
      send: jest.fn(),
      close: jest.fn(),
    })) as any;

    // Simulate a successful connection
    const mockSocket = new WebSocket("ws://mock-url");
    global.WebSocket = jest.fn(() => mockSocket) as any;

    const connectPromise = client.connect();

    // Trigger the open event with a dummy Event object
    mockSocket.onopen?.(new Event("open"));

    await expect(connectPromise).resolves.toBeUndefined();
    expect(client.getIsConnected()).toBe(true);
  });

  it("should handle connection errors", async () => {
    // Mock the WebSocket implementation
    global.WebSocket = jest.fn().mockImplementation(() => ({
      onopen: null,
      onerror: null,
      onclose: null,
      send: jest.fn(),
      close: jest.fn(),
    })) as any;

    const mockSocket = new WebSocket("ws://mock-url");
    global.WebSocket = jest.fn(() => mockSocket) as any;

    const connectPromise = client.connect();

    // Trigger the error event
    const errorEvent = new Event("error");
    mockSocket.onerror?.(errorEvent);

    await expect(connectPromise).rejects.toThrow("WebSocket failed to connect: [object Event]");
    expect(client.getIsConnected()).toBe(false);
  });
});
