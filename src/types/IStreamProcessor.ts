export interface IStreamProcessor {
  init(): void;
  start(): Promise<void>;
  isProcessing(): boolean;
  stop(): void;
  onStreamReset?: () => Promise<void>;
}
