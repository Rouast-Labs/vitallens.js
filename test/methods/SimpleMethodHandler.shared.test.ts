/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { SimpleMethodHandler } from '../../src/methods/SimpleMethodHandler';
import { VitalLensOptions, VitalLensResult } from '../../src/types/core';
import { Frame } from '../../src/processing/Frame';

describe('SimpleMethodHandler', () => {
  // Create a mock subclass that implements the abstract methods.
  class MockSimpleMethodHandler extends SimpleMethodHandler {
    protected getMethodName(): string {
      return 'Mock';
    }

    protected algorithm(rgb: Frame): number[] {
      return [1, 2, 3];
    }

    // New: implement the postprocess method.
    public postprocess(
      signalType: 'ppg' | 'resp',
      data: number[],
      fps: number
    ): number[] {
      // For testing we simply return the data unchanged.
      return data;
    }
  }

  const mockOptions: VitalLensOptions = {
    apiKey: 'test-key',
    method: 'pos',
    requestMode: 'rest',
  };

  const mockFrame = {
    getROI: jest.fn().mockReturnValue([
      { x0: 0, y0: 0, x1: 10, y1: 10 },
      { x0: 1, y0: 1, x1: 11, y1: 11 },
    ]),
    getTimestamp: jest.fn().mockReturnValue([0, 1, 2]),
  } as unknown as Frame;

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize without errors', async () => {
    const handler = new MockSimpleMethodHandler(mockOptions);
    await expect(handler.init()).resolves.toBeUndefined();
  });

  it('should clean up without errors', async () => {
    const handler = new MockSimpleMethodHandler(mockOptions);
    await expect(handler.cleanup()).resolves.toBeUndefined();
  });

  it('should always return true for readiness', () => {
    const handler = new MockSimpleMethodHandler(mockOptions);
    expect(handler.getReady()).toBe(true);
  });

  it('should process a frame and return the correct result', async () => {
    const handler = new MockSimpleMethodHandler(mockOptions);

    const result: VitalLensResult = await handler.process(mockFrame);

    expect(result).toEqual({
      face: {
        coordinates: [
          [0, 0, 10, 10],
          [1, 1, 11, 11],
        ],
        confidence: [1.0, 1.0, 1.0],
        note: 'Face detection coordinates for this face, along with live confidence levels. This method is not capable of providing a confidence estimate, hence returning 1.',
      },
      vital_signs: {
        ppg_waveform: {
          data: [1, 2, 3],
          unit: 'bpm',
          confidence: [1.0, 1.0, 1.0],
          note: 'Estimate of the ppg waveform using Mock. This method is not capable of providing a confidence estimate, hence returning 1.',
        },
      },
      time: [0, 1, 2],
      message:
        'The provided values are estimates and should be interpreted according to the provided confidence levels ranging from 0 to 1. The VitalLens API is not a medical device and its estimates are not intended for any medical purposes.',
    });

    expect(mockFrame.getROI).toHaveBeenCalled();
    expect(mockFrame.getTimestamp).toHaveBeenCalled();
  });
});
