/* eslint-disable @typescript-eslint/no-explicit-any */

import { BufferedResultsConsumer } from '../../src/processing/BufferedResultsConsumer';
import { VitalLensResult } from '../../src/types';

describe('BufferedResultsConsumer', () => {
  let consumer: BufferedResultsConsumer;
  let dispatchMock: jest.Mock;
  let mockPerformanceNow: jest.SpyInstance;

  beforeEach(() => {
    // Use fake timers to control requestAnimationFrame and setTimeout
    jest.useFakeTimers();
    mockPerformanceNow = jest.spyOn(performance, 'now');

    dispatchMock = jest.fn();
    consumer = new BufferedResultsConsumer(dispatchMock);
  });

  afterEach(() => {
    // Restore real timers and mocks after each test
    jest.useRealTimers();
    mockPerformanceNow.mockRestore();
  });

  it('should add results to the queue', () => {
    const results: VitalLensResult[] = [
      { displayTime: 1, time: [], face: {}, vital_signs: {}, message: '' },
      { displayTime: 2, time: [], face: {}, vital_signs: {}, message: '' },
    ];
    consumer.addResults(results);
    // Accessing a private property for testing purposes
    expect((consumer as any).resultQueue).toEqual(results);
  });

  it('should start and stop the consumer loop', () => {
    expect((consumer as any).isRunning).toBe(false);
    consumer.start();
    expect((consumer as any).isRunning).toBe(true);
    consumer.stop();
    expect((consumer as any).isRunning).toBe(false);
  });

  it('should dispatch a result when its displayTime has passed', () => {
    const result: VitalLensResult = {
      displayTime: 1.5, // 1500 ms
      time: [],
      face: {},
      vital_signs: {},
      message: 'test1',
    };
    consumer.addResults([result]);
    consumer.start();

    // Time is before displayTime, should not dispatch
    mockPerformanceNow.mockReturnValue(1499);
    jest.runOnlyPendingTimers(); // Simulates one requestAnimationFrame callback
    expect(dispatchMock).not.toHaveBeenCalled();

    // Time is after displayTime, should dispatch
    mockPerformanceNow.mockReturnValue(1501);
    jest.runOnlyPendingTimers(); // Simulates the next requestAnimationFrame callback
    expect(dispatchMock).toHaveBeenCalledWith(result);
    expect((consumer as any).resultQueue).toHaveLength(0);
  });

  it('should dispatch only the latest of multiple expired results', () => {
    const results: VitalLensResult[] = [
      {
        displayTime: 2.1,
        time: [],
        face: {},
        vital_signs: {},
        message: 'result1',
      },
      {
        displayTime: 2.2,
        time: [],
        face: {},
        vital_signs: {},
        message: 'result2',
      }, // This is the latest expired one
    ];
    consumer.addResults(results);
    consumer.start();

    mockPerformanceNow.mockReturnValue(2300); // Current time is 2.3s
    jest.runOnlyPendingTimers(); // Simulates one requestAnimationFrame callback

    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(dispatchMock).toHaveBeenCalledWith(results[1]);
    expect((consumer as any).resultQueue).toHaveLength(0);
  });

  it('should not dispatch anything if the queue is empty', () => {
    consumer.start();
    mockPerformanceNow.mockReturnValue(1000);
    jest.runOnlyPendingTimers(); // Simulates one requestAnimationFrame callback
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('should not dispatch results whose displayTime has not yet passed', () => {
    const results: VitalLensResult[] = [
      {
        displayTime: 3.1,
        time: [],
        face: {},
        vital_signs: {},
        message: 'future1',
      },
      {
        displayTime: 3.2,
        time: [],
        face: {},
        vital_signs: {},
        message: 'future2',
      },
    ];
    consumer.addResults(results);
    consumer.start();

    mockPerformanceNow.mockReturnValue(3000); // Current time is 3.0s
    jest.runOnlyPendingTimers(); // Simulates one requestAnimationFrame callback

    expect(dispatchMock).not.toHaveBeenCalled();
    expect((consumer as any).resultQueue).toHaveLength(2);
  });
});
