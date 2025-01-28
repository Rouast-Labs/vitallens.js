import { RestClientBase } from "../../src/utils/RestClient.base";

class MockRestClient extends RestClientBase {
  async postRequest(payload: Record<string, any>): Promise<any> {
    if (payload.bad === false) {
      // Simulate a successful response
      return { status: 200 } as Response;
    } else {
      // Simulate a 500 Internal Server Error
      const errorResponse = {
        status: 500,
        ok: false,
        text: async () => "Internal Server Error",
      } as Response;
      return this.handleResponse(errorResponse);
    }
  }
}

describe("RestClientBase", () => {
  let client: RestClientBase;

  beforeEach(() => {
    client = new MockRestClient("test-api-key");
  });

  it("should handle a successful response", async () => {
    const expectedResponse = { status: 200 };
    const result = await client.sendFrames({bad: false}, new Uint8Array([1, 2, 3]));
    expect(result).toEqual(expectedResponse);
  });

  it("should throw an error for HTTP errors", async () => {
    await expect(client.sendFrames({bad: true}, new Uint8Array([1, 2, 3]))).rejects.toThrow(
      "HTTP 500: Internal Server Error"
    );
  });
});
