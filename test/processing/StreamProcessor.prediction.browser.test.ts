/* eslint-disable @typescript-eslint/no-explicit-any */
import { StreamProcessor } from '../../src/processing/StreamProcessor.browser';
import { describe, expect, beforeEach, afterEach, vi, it } from 'vitest';

describe('StreamProcessor prediction handling (Browser)', () => {
  let bufferManager: any;
  let onPredict: ReturnType<typeof vi.fn>;
  let report: ReturnType<typeof vi.fn>;
  let processor: any;

  const result = (data: number[] = [1, 2]) =>
    ({ time: [0], state: { data } }) as any;

  beforeEach(() => {
    bufferManager = {
      cleanup: vi.fn(),
      setState: vi.fn(),
      resetState: vi.fn(),
    };
    onPredict = vi.fn();
    report = vi.fn();
    processor = new StreamProcessor(
      { method: 'vitallens' } as any,
      () => ({ method: 'vitallens', fpsTarget: 30 }) as any,
      { stop: vi.fn() } as any,
      bufferManager,
      null,
      { cleanup: vi.fn() } as any,
      onPredict,
      vi.fn(async () => {}),
      vi.fn(),
      vi.fn(),
      {
        isReady: () => true,
        recreateWorker: vi.fn(),
        onStatus: vi.fn(),
        report,
      }
    );
  });

  afterEach(() => vi.restoreAllMocks());

  it('stores the state, passes the result on and reports the request', () => {
    processor.handlePrediction(result(), processor.generation, 250, 8);
    expect(bufferManager.setState).toHaveBeenCalledWith(
      new Float32Array([1, 2])
    );
    expect(onPredict).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith('apiRequest', 250, 8);
  });

  it('resets the model state when the response carries none', () => {
    processor.handlePrediction(
      { time: [0] } as any,
      processor.generation,
      1,
      1
    );
    expect(bufferManager.resetState).toHaveBeenCalled();
    expect(onPredict).toHaveBeenCalled();
  });

  it('drops a response to a request sent before stop', () => {
    const generation = processor.generation;
    processor.stop();
    processor.handlePrediction(result(), generation, 250, 8);
    expect(bufferManager.setState).not.toHaveBeenCalled();
    expect(onPredict).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
  });

  it('drops a response to a request sent before reset', () => {
    const generation = processor.generation;
    processor.reset();
    processor.handlePrediction(result(), generation, 250, 8);
    expect(bufferManager.setState).not.toHaveBeenCalled();
    expect(onPredict).not.toHaveBeenCalled();
  });

  it('accepts responses to requests sent after a restart', () => {
    processor.stop();
    processor.handlePrediction(result(), processor.generation, 250, 8);
    expect(onPredict).toHaveBeenCalledTimes(1);
  });
});
