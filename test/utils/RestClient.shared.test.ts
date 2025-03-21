/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { RestClientBase } from '../../src/utils/RestClient.base';
import {
  VITALLENS_FILE_ENDPOINT,
  VITALLENS_STREAM_ENDPOINT,
} from '../../src/config/constants';

class MockRestClient extends RestClientBase {
  protected getRestEndpoint(): string {
    return VITALLENS_REST_ENDPOINT;
  }
  async postRequest(payload: Record<string, any>): Promise<any> {
    if (payload.bad === false) {
      // Simulate a successful response
      return { status: 200 } as Response;
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
      new Uint8Array([1, 2, 3])
    );
    expect(result).toEqual(expectedResponse);
  });

  it('should set URL to the provided proxyUrl and omit x-api-key header when proxyUrl is used', () => {
    const proxyUrl = 'https://example.com/proxy';
    const clientWithProxy = new MockRestClient('test-api-key', proxyUrl);
    expect((clientWithProxy as any).url).toEqual(proxyUrl);
    expect((clientWithProxy as any).headers).not.toHaveProperty('x-api-key');
  });

  it('should set URL to default endpoint and include x-api-key header when no proxyUrl is provided', () => {
    const clientNoProxy = new MockRestClient('test-api-key');
    expect((clientNoProxy as any).url).toEqual(VITALLENS_REST_ENDPOINT);
    expect((clientNoProxy as any).headers).toHaveProperty(
      'x-api-key',
      'test-api-key'
    );
  });
});
