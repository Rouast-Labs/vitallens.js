import { RestClientBase } from "./RestClient.base";
import fetch from "node-fetch";

export class RestClient extends RestClientBase {
  /**
   * Sends an HTTP POST request using node-fetch.
   * @param payload - The data to send in the request body.
   * @returns The server's response as a JSON-parsed object.
   */
  protected async postRequest(payload: Record<string, any>): Promise<any> {
    try {
      const response = (await fetch(this.url, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(payload),
      })) as unknown as Response;
      return this.handleResponse(response);
    } catch (error) {
      throw new Error(`POST request failed: ${error}`);
    }
  }
}