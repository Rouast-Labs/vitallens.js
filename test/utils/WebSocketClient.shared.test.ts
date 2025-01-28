import { WebSocketClientBase, BaseWebSocket } from "../../src/utils/WebSocketClient.base";

class MockWebSocket implements BaseWebSocket {
  onmessage: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onclose: ((event: any) => void) | null = null;

  private isClosed = false;
  private sentMessages: any[] = [];

  send(data: any): void {
    if (this.isClosed) throw new Error("WebSocket is closed");
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string): void {
    this.isClosed = true;
    if (this.onclose) {
      this.onclose({ code, reason });
    }
  }

  triggerMessage(event: any) {
    if (this.onmessage) {
      this.onmessage(event);
    }
  }

  triggerError(event: any) {
    if (this.onerror) {
      this.onerror(event);
    }
  }

  getSentMessages(): any[] {
    return this.sentMessages;
  }
}

class TestWebSocketClient extends WebSocketClientBase<MockWebSocket> {
  async connect(): Promise<void> {
    if (this.isConnected) return;

    this.socket = new MockWebSocket();
    this.isConnected = true;
  }
}

describe("WebSocketClientBase", () => {
  let client: TestWebSocketClient;

  beforeEach(() => {
    client = new TestWebSocketClient("test-api-key");
  });

  it("should initialize with the correct connection status", () => {
    expect(client.getIsConnected()).toBe(false);
  });

  it("should connect and set connection status to true", async () => {
    await client.connect();
    expect(client.getIsConnected()).toBe(true);
  });

  it("should close the connection and set connection status to false", async () => {
    await client.connect();
    client.close();
    expect(client.getIsConnected()).toBe(false);
  });

  it("should throw an error when sending frames while not connected", async () => {
    const frames = new Uint8Array([1, 2, 3]);
    await expect(client.sendFrames({}, frames)).rejects.toThrow("WebSocket is not connected");
  });

  it("should send frames and resolve when a response is received", async () => {
    await client.connect();
    const metadata = { test: "data" };
    const frames = new Uint8Array(10 * 1024); // 10 KB data

    const sendPromise = client.sendFrames(metadata, frames);

    // Simulate a response from the WebSocket server
    const socket = (client as any).socket as MockWebSocket;
    socket.triggerMessage({ data: JSON.stringify({ success: true }) });

    const response = await sendPromise;

    expect(response).toEqual({ success: true });

    // Verify sent messages
    const sentMessages = socket.getSentMessages();
    expect(sentMessages.length).toBeGreaterThan(1); // Chunks + final metadata
    expect(sentMessages[sentMessages.length - 1]).toContain('"action":"sendFrames"');
  });

  it("should reject when WebSocket response times out", async () => {
    jest.useFakeTimers(); // Use fake timers to test the timeout
    await client.connect();
    const metadata = { test: "data" };
    const frames = new Uint8Array(10 * 1024); // 10 KB data

    const sendPromise = client.sendFrames(metadata, frames);

    jest.advanceTimersByTime(10000); // Simulate the timeout

    await expect(sendPromise).rejects.toThrow("Timeout waiting for WebSocket response");

    jest.useRealTimers(); // Reset timers
  });
});
