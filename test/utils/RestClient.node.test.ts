/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { RestClient } from '../../src/utils/RestClient.node';

const mockedFetch = jest.fn();
global.fetch = mockedFetch;
const { Response } = globalThis;

describe('RestClient (Node)', () => {
  let client: RestClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new RestClient('test-api-key');
  });

  it('should send frames and return JSON response', async () => {
    // Mock a successful API response
    mockedFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );

    const metadata = { test: 'data' };
    const frames = new Uint8Array([1, 2, 3]);

    const result = await client.sendFrames(metadata, frames, 'file');

    // Verify fetch was called with correct arguments
    expect(mockedFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
        }),
        body: expect.any(String),
      })
    );

    // Check that the result matches the actual structure
    expect(result).toEqual({
      statusCode: 200,
      body: { success: true },
    });
  });

  it('should throw an error for network failure', async () => {
    const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

    // Mock a network failure
    mockedFetch.mockRejectedValueOnce(new Error('Network Error'));

    const metadata = { test: 'data' };
    const frames = new Uint8Array([1, 2, 3]);

    await expect(client.sendFrames(metadata, frames, 'file')).rejects.toThrow(
      'Network Error'
    );
  });
});
