export interface IFFmpegWrapper {
  init(): Promise<void>;
  readVideo(filePath: string, options?: any): Promise<Uint8Array | ArrayBuffer>;
}