import { RestClientBase } from './RestClient.base';
import {
  COMPRESSION_MODE,
  VITALLENS_FILE_ENDPOINT,
  VITALLENS_STREAM_ENDPOINT,
} from '../config/constants';
import fetch from 'node-fetch';
import { promisify } from 'util';
import { deflate, gzip } from 'zlib';
import { InferenceMode, VitalLensAPIResponse } from '../types';

export class RestClient extends RestClientBase {
  /**
   * Get the REST endpoint.
   * @returns The REST endpoint.
   */
  protected getRestEndpoint(mode: InferenceMode): string {
    if (mode === 'file') {
      return process.env.VITALLENS_FILE_ENDPOINT || VITALLENS_FILE_ENDPOINT;
    } else {
      return process.env.VITALLENS_STREAM_ENDPOINT || VITALLENS_STREAM_ENDPOINT;
    }
  }

  /**
   * Sends an HTTP POST request using node-fetch.
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
        ...(isBinary && isCompressed
          ? { 'Content-Encoding': COMPRESSION_MODE }
          : {}),
      };

      const url = this.proxyUrl ?? this.getRestEndpoint(mode);

      const response = (await fetch(url, {
        method: 'POST',
        headers: headers_,
        body: isBinary ? (body as Uint8Array) : JSON.stringify(body),
      })) as unknown as Response;
      return this.handleResponse(response);
    } catch (error) {
      throw new Error(`POST request failed: ${error}`);
    }
  }

  /**
   * Compresses a Uint8Array using the specified COMPRESSION_MODE.
   * Uses Node.js zlib module.
   *
   * @param data - The binary data to compress.
   * @returns A Promise that resolves with the compressed data as a Uint8Array.
   */
  protected async compress(data: Uint8Array): Promise<Uint8Array> {
    if (COMPRESSION_MODE === 'deflate') {
      return new Uint8Array(await promisify(deflate)(data));
    } else if (COMPRESSION_MODE === 'gzip') {
      return new Uint8Array(await promisify(gzip)(data));
    } else {
      return data;
    }
  }
}
