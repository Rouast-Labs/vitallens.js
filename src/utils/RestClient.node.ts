// FILE: src/utils/RestClient.node.ts
import { RestClientBase } from './RestClient.base';
import {
  COMPRESSION_MODE,
  VITALLENS_FILE_ENDPOINT,
  VITALLENS_STREAM_ENDPOINT,
  VITALLENS_RESOLVE_MODEL_ENDPOINT,
} from '../config/constants';
import { Buffer } from 'buffer';
import { promisify } from 'util';
import { deflate, gzip } from 'zlib';
import { InferenceMode, VitalLensAPIResponse } from '../types';
import { ResolveModelResponse } from '../types/IRestClient';

export class RestClient extends RestClientBase {
  /**
   * Get the REST endpoint (Direct API usage).
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
   * Sends a HTTP GET request to resolve which model to use.
   * @param requestedModel - The requested model (optional)
   * @returns The response
   */
  async resolveModel(requestedModel?: string): Promise<ResolveModelResponse> {
    let urlStr: string;
    if (this.proxyUrl) {
      const base = this.proxyUrl.replace(/\/$/, '');
      urlStr = `${base}/resolve-model`;
    } else {
      urlStr =
        process.env.VITALLENS_RESOLVE_MODEL_ENDPOINT ||
        VITALLENS_RESOLVE_MODEL_ENDPOINT;
    }

    const url = new URL(urlStr);
    if (requestedModel) {
      url.searchParams.append('model', requestedModel);
    }

    const headers = {
      ...(this.proxyUrl ? {} : { 'x-api-key': this.apiKey }),
    };

    try {
      const response = (await global.fetch(url.toString(), {
        method: 'GET',
        headers,
      })) as unknown as Response;

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `Failed to resolve model config: Status ${response.status} - ${errorBody}`
        );
      }
      return (await response.json()) as ResolveModelResponse;
    } catch (error) {
      throw new Error(`Model resolution request failed: ${error}`, {
        cause: error,
      });
    }
  }

  /**
   * Sends an HTTP POST request.
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

      let url: string;
      if (this.proxyUrl) {
        const base = this.proxyUrl.replace(/\/$/, '');
        const path = mode === 'file' ? '/file' : '/stream';
        url = `${base}${path}`;
      } else {
        url = this.getRestEndpoint(mode);
      }

      const payload: BodyInit = isBinary
        ? Buffer.from(body as Uint8Array)
        : JSON.stringify(body);

      const response = (await global.fetch(url, {
        method: 'POST',
        headers: headers_,
        body: payload,
      })) as unknown as Response;
      return this.handleResponse(response);
    } catch (error) {
      throw new Error(`POST request failed: ${error}`, { cause: error });
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
