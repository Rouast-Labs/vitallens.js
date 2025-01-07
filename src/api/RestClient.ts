// Handles REST-based communication for VitalLens API.

export class RestClient {
  constructor(private endpoint: string) {}

  async sendFrames(frames: string[]): Promise<any> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frames }),
    });

    if (!response.ok) {
      throw new Error(`REST API Error: ${response.statusText}`);
    }

    return response.json();
  }
}