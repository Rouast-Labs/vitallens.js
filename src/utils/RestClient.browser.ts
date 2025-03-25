import { RestClientBase } from './RestClient.base';
import {
  COMPRESSION_MODE,
  VITALLENS_FILE_ENDPOINT,
  VITALLENS_STREAM_ENDPOINT,
} from '../config/constants';
import { InferenceMode, VitalLensAPIResponse } from '../types';

export class RestClient extends RestClientBase {
  /**
   * Get the REST endpoint.
   * @param mode - The inference mode
   * @returns The REST endpoint.
   */
  protected getRestEndpoint(mode: InferenceMode): string {
    if (mode === 'file') {
      return VITALLENS_FILE_ENDPOINT;
    } else {
      return VITALLENS_STREAM_ENDPOINT;
    }
  }

  /**
   * Sends an HTTP POST request using the browser's fetch API.
   * @param headers - The headers.
   * @param body - The body.
   * @param mode - The inference mode ('file' or 'stream').
   * @returns The server's response as a JSON-parsed object.
   */
  protected async postRequest(
    headers: Record<string, string>,
    body: Record<string, unknown> | Uint8Array,
    mode: InferenceMode
  ): Promise<VitalLensAPIResponse> {
    try {
      const isBinary = mode === 'stream';
      const isCompressed = COMPRESSION_MODE !== 'none';

      const headers_ = {
        ...headers,
        ...(this.proxyUrl ? {} : { 'x-api-key': this.apiKey }),
        ...(isBinary
          ? { 'Content-Type': 'application/octet-stream' }
          : { 'Content-Type': 'application/json' }),
        ...(isBinary && isCompressed ? { 'X-Encoding': COMPRESSION_MODE } : {}),
      };

      const url = this.proxyUrl ?? this.getRestEndpoint(mode);

      // const startTime = performance.now();
      const response = await fetch(url, {
        method: 'POST',
        headers: headers_,
        body: isBinary ? (body as Uint8Array) : JSON.stringify(body),
      });
      // const endTime = performance.now();
      // const duration = endTime - startTime;
      // console.log(`fetch finished in ${duration.toFixed(0)} ms`);

      return this.handleResponse(response);
    } catch (error) {
      throw new Error(`POST request failed: ${error}`);
    }
  }

  /**
   * Compresses a Uint8Array using the specified COMPRESSION_MODE.
   * @param data - The binary data to compress.
   * @returns A Promise that resolves with the compressed data as a Uint8Array.
   * @throws An error if an unsupported compression mode is specified.
   */
  protected async compress(data: Uint8Array): Promise<Uint8Array> {
    if (COMPRESSION_MODE === 'deflate' || COMPRESSION_MODE === 'gzip') {
      const stream = new CompressionStream(COMPRESSION_MODE);
      const writer = stream.writable.getWriter();
      writer.write(data);
      writer.close();

      const compressedStream = await new Response(
        stream.readable
      ).arrayBuffer();
      return new Uint8Array(compressedStream);
    } else {
      return data;
    }
  }
}
