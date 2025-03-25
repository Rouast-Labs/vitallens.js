/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { RestClientBase } from '../../src/utils/RestClient.base';
import {
  VITALLENS_FILE_ENDPOINT,
  VITALLENS_STREAM_ENDPOINT,
} from '../../src/config/constants';
import { InferenceMode } from '../../src/types';

class MockRestClient extends RestClientBase {
  protected getRestEndpoint(): string {
    return VITALLENS_FILE_ENDPOINT;
  }
  async postRequest(
    headers: Record<string, string>,
    body: Record<string, any> | Uint8Array,
    mode: InferenceMode
  ): Promise<any> {
    // If body is a JSON object (for 'file' mode), inspect its 'bad' property
    const payload = !(body instanceof Uint8Array)
      ? (body as Record<string, any>)
      : {};
    if (payload.bad === false) {
      // Simulate a successful response
      return { status: 200 };
    } else {
      // Simulate a 500 Internal Server Error
      const errorResponse = {
        status: 500,
        ok: false,
        text: async () => 'Internal Server Error',
      } as Response;
      return this.handleResponse(errorResponse);
    }
  }
  protected async compress(data: Uint8Array): Promise<any> {
    return data;
  }
}

describe('RestClientBase', () => {
  let client: RestClientBase;

  beforeEach(() => {
    // Updated constructor: pass options object with apiKey (and optionally proxyUrl)
    client = new MockRestClient('test-api-key');
  });

  it('should handle a successful response', async () => {
    const expectedResponse = { status: 200 };
    const result = await client.sendFrames(
      { bad: false },
      new Uint8Array([1, 2, 3]),
      'file'
    );
    expect(result).toEqual(expectedResponse);
  });

  it('should set provided proxyUrl and x-api-key', () => {
    const proxyUrl = 'https://example.com/proxy';
    const clientWithProxy = new MockRestClient('test-api-key', proxyUrl);
    expect((clientWithProxy as any).proxyUrl).toEqual(proxyUrl);
    expect((clientWithProxy as any).apiKey).toEqual('test-api-key');
  });

  it('should set x-api-key', () => {
    const clientNoProxy = new MockRestClient('test-api-key');
    expect((clientNoProxy as any).proxyUrl).toBeNull();
    expect((clientNoProxy as any).apiKey).toEqual('test-api-key');
  });
});
