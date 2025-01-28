import { RestClient } from "../../src/utils/RestClient.browser";

describe("RestClient (Browser)", () => {
  let client: RestClient;

  beforeEach(() => {
    // Mock the global fetch function
    global.fetch = jest.fn();
    client = new RestClient("test-api-key");
  });

  afterEach(() => {
    jest.clearAllMocks(); // Clear mocks after each test
  });

  it("should send frames and return JSON response", async () => {
    // Mock a successful API response with .text() method
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true }),
      json: async () => ({ success: true }),
    });

    const metadata = { test: "data" };
    const frames = new Uint8Array([1, 2, 3]);

    const result = await client.sendFrames(metadata, frames);

    // Verify fetch was called with correct arguments
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "x-api-key": "test-api-key",
        }),
        body: expect.any(String), // Verify the payload includes a JSON string
      })
    );

    // Check that the result matches the expected structure
    expect(result).toEqual({
      statusCode: 200,
      body: { success: true },
    });
  });

  it("should throw an error for network failure", async () => {
    // Mock a network failure
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network Error"));

    const metadata = { test: "data" };
    const frames = new Uint8Array([1, 2, 3]);

    await expect(client.sendFrames(metadata, frames)).rejects.toThrow("Network Error");
  });

  it("should handle HTTP error responses", async () => {
    // Mock a 500 Internal Server Error response with .text() method
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Server Error",
    });

    const metadata = { test: "data" };
    const frames = new Uint8Array([1, 2, 3]);

    await expect(client.sendFrames(metadata, frames)).rejects.toThrow(
      "HTTP 500: Server Error"
    );
  });
});
