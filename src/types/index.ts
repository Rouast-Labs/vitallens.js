export class FrameData {
  constructor(private base64: string) {}

  toBase64(): string {
    return this.base64;
  }
}
