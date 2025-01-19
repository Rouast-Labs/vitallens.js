import { VitalsEstimateManager } from '../../src/processing/VitalsEstimateManager';
import { MethodConfig } from '../../src/config/methodsConfig';
import { VitalLensOptions } from '../../src/types/core';
import { jest } from '@jest/globals';
import FFT from "fft.js";

describe('VitalsEstimateManager', () => {
  let methodConfig: MethodConfig;
  let options: VitalLensOptions;
  let manager: VitalsEstimateManager;

  beforeEach(() => {
    methodConfig = {
      method: 'g',
      roiMethod: 'face',
      fpsTarget: 1,
      minWindowLength: 10,
      maxWindowLength: 10,
      windowOverlap: 5,
      requiresState: false
    };
    options = {
      method: 'g',
    };
    manager = new VitalsEstimateManager(methodConfig, options);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with the correct buffer sizes based on fpsTarget and constants', () => {
      expect(manager).toHaveProperty('fpsTarget', 1);
      expect(manager).toHaveProperty('bufferSizeAgg', 1 * 10); // Assuming AGG_WINDOW_SIZE = 10
      expect(manager).toHaveProperty('bufferSizePpg', 1 * 10); // Assuming CALC_HR_WINDOW_SIZE = 10
      expect(manager).toHaveProperty('bufferSizeResp', 1 * 30); // Assuming CALC_RR_WINDOW_SIZE = 30
      expect(manager).toHaveProperty('minBufferSizePpg', 1 * 2); // Assuming CALC_HR_MIN_WINDOW_SIZE = 2
      expect(manager).toHaveProperty('minBufferSizeResp', 1 * 4); // Assuming CALC_RR_MIN_WINDOW_SIZE = 4
    });
  });

  describe('processIncrementalResult', () => {

    beforeEach(() => {
      jest.spyOn(manager as any, 'updateWaveform').mockImplementation((...args) => {});
      jest.spyOn(manager as any, 'updateTimestamps').mockImplementation((...args) => {});
      jest.spyOn(manager as any, 'computeAggregatedResult').mockImplementation(async (...args) => {
        return {
          vitals: {
            ppgWaveform: [1, 2, 3],
            respiratoryWaveform: [4, 5, 6],
          },
          time: [1000, 1001, 1002],
        };
      });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should throw an error if no waveform data is provided', async () => {
      await expect(
        manager.processIncrementalResult({ vitals: {}, time: [] }, 'sourceId', 'complete')
      ).rejects.toThrow('No waveform data found in incremental result.');
    });

    it('should initialize buffers and timestamps for a new sourceId', async () => {
      const incrementalResult = {
        vitals: { ppgWaveform: [1, 2, 3], respiratoryWaveform: [4, 5, 6] },
        time: [1000, 1001, 1002],
      };
    
      await manager.processIncrementalResult(incrementalResult, 'source1', 'complete');
    
      expect(manager['waveformBuffers'].has('source1')).toBe(true);
      expect(manager['updateTimestamps']).toHaveBeenCalledWith('source1', incrementalResult.time, 'complete');
      expect(manager['updateWaveform']).toHaveBeenCalledWith(
        expect.anything(), // Mocked waveform buffer
        incrementalResult.vitals.ppgWaveform,
        expect.any(Number), // Pass any number for buffer size
        'complete' // Mode
      );
    });
    

    it('should update timestamps and waveforms', async () => {
      manager['timestamps'].set('source1', [996, 997, 998, 999, 1000, 1001, 1002, 1003, 1004, 1005]);
      manager['waveformBuffers'].set('source1', {
        ppg: {
          sum: [1, 2, 3, 4, 5, 6],
          count: [1, 1, 1, 1, 1, 1],
        },
        resp: {
          sum: [4, 5, 6, 7, 8, 9],
          count: [1, 1, 1, 1, 1, 1],
        },
      });
  
      const incrementalResult = {
        vitals: { ppgWaveform: [1, 2, 3, 4, 5, 6], respiratoryWaveform: [4, 5, 6, 7, 8, 9] },
        time: [1001, 1002, 1003, 1004, 1005, 1006],
      };
  
      const result = await manager.processIncrementalResult(incrementalResult, 'source1', 'complete');
  
      expect(manager['updateTimestamps']).toHaveBeenCalledWith('source1', incrementalResult.time, 'complete');
      expect(manager['updateWaveform']).toHaveBeenCalledTimes(2); // Called for both PPG and respiratory waveforms
      expect(manager['computeAggregatedResult']).toHaveBeenCalledWith(
        'source1',
        'complete',
        incrementalResult.time,
        incrementalResult.vitals.ppgWaveform,
        incrementalResult.vitals.respiratoryWaveform
      );
      expect(result).toEqual({
        vitals: {
          ppgWaveform: [1, 2, 3],
          respiratoryWaveform: [4, 5, 6],
        },
        time: [1000, 1001, 1002],
      });
    });
  });

  describe('updateTimestamps', () => {
    let manager: VitalsEstimateManager;
  
    beforeEach(() => { 
      manager = new VitalsEstimateManager(methodConfig, options);
      manager['timestamps'].set('source1', [100, 101, 102, 103, 104]); // Initialize source1
    });
  
    it('should append new timestamps excluding overlap', () => {
      const newTimestamps = [105, 106, 107, 108, 109, 110];
      manager['updateTimestamps']('source1', newTimestamps, 'aggregated');
  
      const updatedTimestamps = manager['timestamps'].get('source1');
      expect(updatedTimestamps).toEqual([100, 101, 102, 103, 104, 110]);
    });
  
    it('should retain all timestamps in "complete" mode', () => {
      const newTimestamps = [105, 106, 107, 108, 109, 110];
      manager['updateTimestamps']('source1', newTimestamps, 'complete');
  
      const updatedTimestamps = manager['timestamps'].get('source1');
      expect(updatedTimestamps).toEqual([100, 101, 102, 103, 104, 110]);
    });
  
    it('should trim timestamps when exceeding the buffer size', () => {
      // Set maxBufferSize to 10 for this test
      manager['bufferSizePpg'] = 5;
      manager['bufferSizeResp'] = 5;
  
      const newTimestamps = [105, 106, 107, 108, 109, 110];
      manager['updateTimestamps']('source1', newTimestamps, 'aggregated');
  
      const updatedTimestamps = manager['timestamps'].get('source1');
      expect(updatedTimestamps).toEqual([101, 102, 103, 104, 110]);
    });
  
    it('should handle an empty source gracefully', () => {
      manager['timestamps'].set('newSource', []);
      const newTimestamps = [200, 201, 202];
  
      manager['updateTimestamps']('newSource', newTimestamps, 'aggregated');
      const updatedTimestamps = manager['timestamps'].get('newSource');
      expect(updatedTimestamps).toEqual([200, 201, 202]);
    });
  
    it('should throw an error if sourceId is missing', () => {
      expect(() =>
        manager['updateTimestamps']('missingSource', [200, 201, 202], 'aggregated')
      ).toThrowError();
    });
  });
  
  describe('updateWaveform', () => {  
    it('should initialize the buffer when empty', () => {
      const buffer = { sum: [], count: [] };
      const incremental = [1, 2, 3, 4, 5];
  
      manager['updateWaveform'](buffer, incremental, 10, 'aggregated');
  
      expect(buffer.sum).toEqual([1, 2, 3, 4, 5]);
      expect(buffer.count).toEqual([1, 1, 1, 1, 1]);
    });
  
    it('should handle overlap correctly and update the buffer in aggregated mode', () => {
      const buffer = { sum: [1, 1, 1, 1, 1, 2, 3, 4, 5, 6], count: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1] };
      const incremental = [1, 2, 3, 4, 5, 6];
      const maxBufferSize = 10;
  
      manager['updateWaveform'](buffer, incremental, maxBufferSize, 'aggregated');

      expect(buffer.sum).toEqual([1, 1, 1, 1, 3, 5, 7, 9, 11, 6]);
      expect(buffer.count).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 2, 1]);
    });
  
    it('should handle overlap correctly and update the buffer in complete mode', () => {
      const buffer = { sum: [1, 1, 1, 1, 1, 2, 3, 4, 5, 6], count: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1] };
      const incremental = [1, 2, 3, 4, 5, 6];
      const maxBufferSize = 10;
  
      manager['updateWaveform'](buffer, incremental, maxBufferSize, 'complete');
  
      expect(buffer.sum).toEqual([1, 1, 1, 1, 1, 3, 5, 7, 9, 11, 6]);
      expect(buffer.count).toEqual([1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 1]);
    });
  });
  
  describe('computeAggregatedResult', () => {
    beforeEach(() => {
      jest.spyOn(manager as any, 'estimateHeartRate').mockReturnValue(75); // Example HR
      jest.spyOn(manager as any, 'estimateRespiratoryRate').mockReturnValue(18); // Example RR
      jest.spyOn(manager as any, 'getCurrentFps').mockReturnValue(30); // Example FPS
    });
  
    afterEach(() => {
      jest.clearAllMocks();
    });
  
    it('should return an empty result if no timestamps or waveforms exist', async () => {
      const result = await manager['computeAggregatedResult']('source1', 'complete');
      expect(result).toEqual({ vitals: {}, state: null, time: [] });
    });
  
    it('should handle incremental mode with overlapping timestamps', async () => {
      const incrementalTime = [1000, 1001, 1002, 1003, 1004, 1005];
      const incrementalPpg = [1, 2, 3, 4, 5, 6];
      const incrementalResp = [6, 7, 8, 9, 10, 11];
      manager['timestamps'].set('source1', [1000, 1001, 1002, 1003, 1004])
      manager['waveformBuffers'].set('source1', {
        ppg: { sum: [10, 20, 30, 40, 50], count: [1, 1, 1, 1, 1] },
        resp: { sum: [60, 70, 80, 90, 100], count: [1, 1, 1, 1, 1] },
      });
  
      const result = await manager['computeAggregatedResult'](
        'source1',
        'incremental',
        incrementalTime,
        incrementalPpg,
        incrementalResp
      );
  
      expect(result.time).toEqual([1005]);
      expect(result.vitals.ppgWaveform).toEqual([6]);
      expect(result.vitals.respiratoryWaveform).toEqual([11]);
    });
  
    it('should handle aggregated mode with averaged waveforms', async () => {
      manager['timestamps'].set('source1', [1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010]);
      manager['waveformBuffers'].set('source1', {
        ppg: { sum: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110], count: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
        resp: { sum: [60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160], count: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2] },
      });
  
      const result = await manager['computeAggregatedResult']('source1', 'aggregated');
  
      expect(result.time).toEqual([1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010]);
      expect(result.vitals.ppgWaveform).toEqual([10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
      expect(result.vitals.respiratoryWaveform).toEqual([35, 40, 45, 50, 55, 60, 65, 70, 75, 80]);
      expect(result.vitals.heartRate).toEqual(75);
      expect(result.vitals.respiratoryRate).toEqual(18);
    });
  
    it('should handle complete mode with full timestamps and waveforms', async () => {
      manager['timestamps'].set('source1', [1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010]);
      manager['waveformBuffers'].set('source1', {
        ppg: { sum: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110], count: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
        resp: { sum: [60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160], count: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2] },
      });
  
      const result = await manager['computeAggregatedResult']('source1', 'complete');
  
      expect(result.time).toEqual([1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010]);
      expect(result.vitals.ppgWaveform).toEqual([10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
      expect(result.vitals.respiratoryWaveform).toEqual([30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80]);
      expect(result.vitals.heartRate).toEqual(75);
      expect(result.vitals.respiratoryRate).toEqual(18);
    });
  
    it('should exclude HR and RR if the buffer size is below minimum', async () => {
      manager['waveformBuffers'].set('source1', {
        ppg: { sum: [10], count: [1] },
        resp: { sum: [30], count: [1] },
      });
  
      const result = await manager['computeAggregatedResult']('source1', 'aggregated');
      expect(result.vitals.heartRate).toBeUndefined();
      expect(result.vitals.respiratoryRate).toBeUndefined();
    });
  });

  describe('getCurrentFps', () => {
  
    it('should return null if there are less than 2 timestamps', () => {
      manager['timestamps'].set('source1', [1000]);
      const fps = manager['getCurrentFps']('source1', 5);
      expect(fps).toBeNull();
    });
  
    it('should return null if there are no timestamps for the sourceId', () => {
      const fps = manager['getCurrentFps']('source1', 5);
      expect(fps).toBeNull();
    });
  
    it('should calculate FPS correctly for a valid set of timestamps', () => {
      manager['timestamps'].set('source1', [1000, 1005, 1010, 1015, 1020]);
      const fps = manager['getCurrentFps']('source1', 5);
      expect(fps).toBeCloseTo(0.2, 2);
    });
  
    it('should only consider up to the given buffer size', () => {
      manager['timestamps'].set('source1', [1000, 1005, 1010, 1015, 1020]);
      const fps = manager['getCurrentFps']('source1', 3);
      expect(fps).toBeCloseTo(0.2, 2);
    });
  
    it('should calculate FPS correctly for irregular intervals', () => {
      manager['timestamps'].set('source1', [1000, 1010, 1020, 1050, 1100]);
      const fps = manager['getCurrentFps']('source1', 5);
      const expectedInterval = (10 + 10 + 30 + 50) / 4;
      const expectedFps = 1 / expectedInterval;
      expect(fps).toBeCloseTo(expectedFps, 2);
    });
  
    it('should return null if all timestamps are identical', () => {
      manager['timestamps'].set('source1', [1000, 1000, 1000]);
      const fps = manager['getCurrentFps']('source1', 5);
      expect(fps).toBeNull();
    });
  });
    

  describe('estimateRateFromFFT', () => {
  
    it('should throw an error if the waveform is empty', () => {
      expect(() => {
        manager['estimateRateFromFFT']([], 30, 0.5, 3.5);
      }).toThrowError('Invalid waveform data, sampling frequency, or frequency range.');
    });
  
    it('should throw an error if samplingFrequency is non-positive', () => {
      expect(() => {
        manager['estimateRateFromFFT']([1, 2, 3], 0, 0.5, 3.5);
      }).toThrowError('Invalid waveform data, sampling frequency, or frequency range.');
    });
  
    it('should throw an error if minFrequency is greater than or equal to maxFrequency', () => {
      expect(() => {
        manager['estimateRateFromFFT']([1, 2, 3], 30, 3.5, 0.5);
      }).toThrowError('Invalid waveform data, sampling frequency, or frequency range.');
    });
  
    it('should correctly estimate the dominant frequency within the range', () => {
      const waveform = [0, 1, 0, -1, 0, 1, 0, -1]; // 2 Hz dominant frequency
      const samplingFrequency = 8; // Sampling rate in Hz
      const result = manager['estimateRateFromFFT'](waveform, samplingFrequency, 0.5, 3); // Frequency range includes 1 Hz
      expect(result).toBeCloseTo(2 * 60, 0.1); // Expected: 2 Hz = 120 BPM
    });
  
    it('should estimate the frequency with higher resolution when desiredResolutionHz is specified', () => {
      // Generate a sine wave with a frequency of 1.25 Hz sampled at 30 Hz
      const frequency = 1.25; // Frequency in Hz
      const samplingFrequency = 30; // Sampling rate in Hz
      const duration = 3; // Duration in seconds
      const numSamples = samplingFrequency * duration;
      const waveform = Array.from({ length: numSamples }, (_, i) =>
        Math.sin(2 * Math.PI * frequency * i / samplingFrequency)
      );
    
      const minFrequency = 1.0; // Minimum frequency in Hz
      const maxFrequency = 2.0; // Maximum frequency in Hz
      const desiredResolutionHz = 0.001; // Higher resolution in Hz
    
      const result = manager['estimateRateFromFFT'](waveform, samplingFrequency, minFrequency, maxFrequency, desiredResolutionHz);
    
      // Expect the result to be close to 75 BPM (1.25 Hz * 60 seconds)
      expect(result).toBeCloseTo(75, .1);
    });    

    it('should handle a waveform with multiple frequencies and return the most dominant within the range', () => {
      const waveform = Array.from({ length: 128 }, (_, n) =>
        Math.sin(2 * Math.PI * 1 * n / 128) + 0.5 * Math.sin(2 * Math.PI * 3 * n / 128)
      ); // Mixture of 1 Hz and 3 Hz
      const samplingFrequency = 128; // Sampling rate in Hz
      const result = manager['estimateRateFromFFT'](waveform, samplingFrequency, 0.5, 2); // Frequency range includes only 1 Hz
      expect(result).toBeCloseTo(1 * 60, 1); // Expected: 1 Hz = 60 BPM
    });
  });
});
