/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { VitalsEstimateManager } from '../../src/processing/VitalsEstimateManager';
import {
  MethodConfig,
  VitalLensOptions,
  VitalLensResult,
} from '../../src/types/core';
import { jest } from '@jest/globals';
import * as physio from '../../src/utils/physio';

// Mock constants to ensure predictable window sizes in tests
jest.mock('../../src/config/constants', () => ({
  AGG_WINDOW_SIZE: 4,
  CALC_HR_MIN: 40,
  CALC_HR_MAX: 240,
  CALC_HR_MIN_WINDOW_SIZE: 2,
  CALC_HR_WINDOW_SIZE: 10,
  CALC_RR_MIN: 1,
  CALC_RR_MAX: 60,
  CALC_RR_MIN_WINDOW_SIZE: 4,
  CALC_RR_WINDOW_SIZE: 30,
  CALC_HRV_SDNN_MIN_T: 5,
  CALC_HRV_RMSSD_MIN_T: 5,
  CALC_HRV_LFHF_MIN_T: 5,
}));

jest.mock('../../src/utils/physio');

const dummyPostprocessFn = (
  signalType: string,
  data: number[],
  fps: number,
  light: boolean
): number[] => {
  return data;
};

describe('VitalsEstimateManager', () => {
  let methodConfig: MethodConfig;
  let options: VitalLensOptions;
  let manager: VitalsEstimateManager;

  // Cast the imported physio functions to Jest mocks for type safety
  const mockedEstimateRateFromFFT = physio.estimateRateFromFFT as jest.Mock;
  const mockedEstimateHrv = physio.estimateHrv as jest.Mock;

  beforeEach(() => {
    methodConfig = {
      method: 'g',
      roiMethod: 'face',
      fpsTarget: 1,
      minWindowLength: 10,
      maxWindowLength: 10,
      requiresState: false,
      bufferOffset: 1,
      supportedVitals: ['heart_rate', 'ppg_waveform'],
    };
    options = {
      method: 'g',
      overrideFpsTarget: 1,
      waveformMode: 'windowed',
    };
    manager = new VitalsEstimateManager(
      () => methodConfig,
      options,
      dummyPostprocessFn
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with the correct buffer sizes based on fpsTarget and constants', () => {
      expect(manager).toHaveProperty('fpsTarget', 1);
      expect(manager).toHaveProperty('bufferSizeAgg', 1 * 4);
    });
  });

  describe('processIncrementalResult', () => {
    beforeEach(() => {
      // Spy on internal methods to verify calls without executing logic
      jest
        .spyOn(manager as any, 'updateSignalBuffer')
        .mockImplementation(() => {});
      jest
        .spyOn(manager as any, 'updateTimestamps')
        .mockImplementation(() => {});
      jest.spyOn(manager as any, 'updateFaces').mockImplementation(() => {});
      jest.spyOn(manager as any, 'assembleResult').mockResolvedValue({
        time: [1000, 1001, 1002],
        face: {},
        vital_signs: {},
      });
    });

    it('should initialize buffers and timestamps for a new sourceId', async () => {
      const incrementalResult = {
        face: {},
        time: [1000, 1001, 1002],
        vital_signs: {
          ppg_waveform: {
            data: [1, 2, 3],
            confidence: [0.8, 0.9, 1.0],
            unit: '',
            note: '',
          },
          respiratory_waveform: {
            data: [4, 5, 6],
            confidence: [0.7, 0.8, 0.9],
            unit: '',
            note: '',
          },
        },
        message: '',
      };

      await manager.processIncrementalResult(
        incrementalResult,
        'source1',
        'complete'
      );

      // Verify timestamp update call
      expect(manager['updateTimestamps']).toHaveBeenCalledWith(
        'source1',
        incrementalResult.time,
        'windowed',
        0
      );

      // Verify signal buffer updates
      expect(manager['updateSignalBuffer']).toHaveBeenCalledWith(
        'source1',
        'ppg_waveform',
        [1, 2, 3],
        [0.8, 0.9, 1.0],
        'windowed',
        0
      );

      expect(manager['updateSignalBuffer']).toHaveBeenCalledWith(
        'source1',
        'respiratory_waveform',
        [4, 5, 6],
        [0.7, 0.8, 0.9],
        'windowed',
        0
      );
    });

    it('should update timestamps and waveforms with correct overlap', async () => {
      manager['timestamps'].set(
        'source1',
        [996, 997, 998, 999, 1000, 1001, 1002, 1003, 1004, 1005]
      );

      const incrementalResult = {
        time: [1001, 1002, 1003, 1004, 1005, 1006],
        vital_signs: {
          ppg_waveform: {
            data: [1, 2, 3, 4, 5, 6],
            confidence: [0.9, 0.9, 0.9, 0.9, 0.9, 0.9],
            unit: '',
            note: '',
          },
        },
        face: {
          coordinates: Array(6).fill([0, 0, 20, 20]) as Array<
            [number, number, number, number]
          >,
          confidence: Array(6).fill(0.95),
        },
        message: '',
      };

      await manager.processIncrementalResult(
        incrementalResult,
        'source1',
        'complete'
      );

      // Overlap of 5 frames (1001-1005)
      expect(manager['updateTimestamps']).toHaveBeenCalledWith(
        'source1',
        incrementalResult.time,
        options.waveformMode!,
        5
      );
      expect(manager['updateFaces']).toHaveBeenCalledWith(
        'source1',
        incrementalResult.face,
        options.waveformMode!,
        5
      );
      expect(manager['updateSignalBuffer']).toHaveBeenCalledWith(
        'source1',
        'ppg_waveform',
        expect.any(Array),
        expect.any(Array),
        options.waveformMode!,
        5
      );
    });
  });

  describe('produceBufferedResults', () => {
    it('should process each non-overlapping frame and return an array of results', async () => {
      manager['timestamps'].set('source1', [1000, 1001]);

      const incrementalResult: VitalLensResult = {
        time: [1001, 1002, 1003],
        vital_signs: {
          ppg_waveform: {
            data: [1, 2, 3],
            confidence: [0.9, 0.9, 0.9],
            unit: '',
            note: '',
          },
        },
        face: {},
        message: 'Processing',
      };

      const processMock = jest
        .spyOn(manager, 'processIncrementalResult')
        .mockImplementation(async (res, src, mode, light, ret) => {
          return { ...res, message: `processed ${res.time![0]}` };
        });

      const results = await manager.produceBufferedResults(
        incrementalResult,
        'source1',
        'windowed'
      );

      expect(results).toHaveLength(2);
      expect(processMock).toHaveBeenCalledTimes(2);
      expect(processMock).toHaveBeenCalledWith(
        expect.objectContaining({
          time: [1002],
          display_time: 1002 + methodConfig.bufferOffset,
          vital_signs: {
            ppg_waveform: {
              data: [2],
              confidence: [0.9],
              unit: '',
              note: '',
            },
          },
        }),
        'source1',
        'windowed',
        true,
        true
      );
      expect(processMock).toHaveBeenCalledWith(
        expect.objectContaining({
          time: [1003],
          display_time: 1003 + methodConfig.bufferOffset,
          vital_signs: {
            ppg_waveform: {
              data: [3],
              confidence: [0.9],
              unit: '',
              note: '',
            },
          },
        }),
        'source1',
        'windowed',
        true,
        true
      );

      // Check the final returned array
      expect(results![0].message).toBe('processed 1002');
      expect(results![1].message).toBe('processed 1003');
    });
  });

  describe('getUpdatedValues', () => {
    it('should append new values when there is no overlap', () => {
      const currentValues = [1000, 1001, 1002];
      const newValues = [1003, 1004, 1005];

      manager['timestamps'].set('source1', currentValues);
      manager['updateTimestamps']('source1', newValues, 'incremental', 0);

      const result = manager['timestamps'].get('source1');
      expect(result).toEqual([1000, 1001, 1002, 1003, 1004, 1005]);
    });

    it('should handle overlap correctly and update the array', () => {
      const currentValues = [1000, 1001, 1002, 1003, 1004];
      const newValues = [1003, 1004, 1005, 1006, 1007];
      manager['timestamps'].set('source1', currentValues);
      manager['updateTimestamps']('source1', newValues, 'incremental', 2);

      const result = manager['timestamps'].get('source1');
      expect(result).toEqual([1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007]);
    });

    it('should trim the array to the maximum buffer size (safety cap) in non-complete mode', () => {
      const fps = 1;
      const maxCap = fps * 90;
      const currentValues = Array.from({ length: maxCap }, (_, i) => i);
      const newValues = [maxCap, maxCap + 1];

      manager['timestamps'].set('source1', currentValues);
      manager['updateTimestamps']('source1', newValues, 'windowed', 0);

      const result = manager['timestamps'].get('source1');
      expect(result!.length).toBe(maxCap);
      expect(result![result!.length - 1]).toBe(maxCap + 1);
    });

    it('should keep all values in complete mode regardless of buffer size', () => {
      const fps = 1;
      const maxCap = fps * 90;
      const currentValues = Array.from({ length: maxCap }, (_, i) => i);
      const newValues = [maxCap, maxCap + 1];

      manager['timestamps'].set('source1', currentValues);
      manager['updateTimestamps']('source1', newValues, 'complete', 0);

      const result = manager['timestamps'].get('source1');
      expect(result!.length).toBe(maxCap + 2);
    });
  });

  describe('getUpdatedSumCount', () => {
    it('should initialize sum and count arrays when they are empty', () => {
      const currentBuffer = { sum: [], count: [] };
      const incremental = [1, 2, 3];
      const result = manager['getUpdatedSumCount'](
        currentBuffer,
        incremental,
        'incremental',
        10,
        0
      );
      expect(result.sum).toEqual([1, 2, 3]);
      expect(result.count).toEqual([1, 1, 1]);
    });

    it('should handle overlap correctly and update sum and count', () => {
      const currentBuffer = { sum: [1, 2, 3], count: [1, 1, 1] };
      const incremental = [3, 4, 5];
      const result = manager['getUpdatedSumCount'](
        currentBuffer,
        incremental,
        'incremental',
        10,
        1
      );
      expect(result.sum).toEqual([1, 2, 6, 4, 5]);
      expect(result.count).toEqual([1, 1, 2, 1, 1]);
    });

    it('should trim sum and count arrays to the maximum buffer size in non-complete mode', () => {
      const currentBuffer = { sum: [1, 2, 3, 4, 5], count: [1, 1, 1, 1, 1] };
      const incremental = [6, 7, 8, 9, 10];
      const result = manager['getUpdatedSumCount'](
        currentBuffer,
        incremental,
        'windowed',
        8,
        0
      );
      expect(result.sum).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
      expect(result.count).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
    });

    it('should keep all values in complete mode regardless of buffer size', () => {
      const currentBuffer = { sum: [1, 2, 3, 4, 5], count: [1, 1, 1, 1, 1] };
      const incremental = [6, 7, 8, 9, 10];
      const result = manager['getUpdatedSumCount'](
        currentBuffer,
        incremental,
        'complete',
        8,
        0
      );
      expect(result.sum).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(result.count).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    });
  });

  describe('updateTimestamps', () => {
    beforeEach(() => {
      manager['timestamps'].set('source1', [1000, 1001, 1002, 1003]);
    });

    it('should set the updated timestamps correctly in the map', () => {
      const newTimestamps = [1003, 1004, 1005];
      manager['updateTimestamps']('source1', newTimestamps, 'incremental', 1);
      const updatedTimestamps = manager['timestamps'].get('source1');
      expect(updatedTimestamps).toEqual([1000, 1001, 1002, 1003, 1004, 1005]);
    });
  });

  describe('updateFaces', () => {
    beforeEach(() => {
      manager['faces'].set('source1', {
        coordinates: [
          [0, 0, 20, 20],
          [10, 10, 30, 30],
        ] as Array<[number, number, number, number]>,
        confidence: [0.8, 0.9],
      });
    });

    it('should set the updated faces correctly in the map', () => {
      const newFaces = {
        coordinates: [
          [15, 15, 25, 25],
          [20, 20, 40, 40],
        ] as Array<[number, number, number, number]>,
        confidence: [0.95, 0.99],
        note: 'New face note',
      };

      manager['updateFaces']('source1', newFaces, 'incremental', 0);

      const updatedFaces = manager['faces'].get('source1');
      expect(updatedFaces).toEqual({
        coordinates: [
          [0, 0, 20, 20],
          [10, 10, 30, 30],
          [15, 15, 25, 25],
          [20, 20, 40, 40],
        ],
        confidence: [0.8, 0.9, 0.95, 0.99],
      });
      expect(manager['faceNote'].get('source1')).toEqual('New face note');
    });

    it('should not update faces if newFaces is missing confidence or coordinates', () => {
      const newFaces = { coordinates: undefined, confidence: undefined };
      manager['updateFaces']('source1', newFaces as any, 'incremental', 0);

      const updatedFaces = manager['faces'].get('source1');
      expect(updatedFaces!.coordinates.length).toBe(2);
    });
  });

  describe('updateSignalBuffer', () => {
    beforeEach(() => {
      const sourceBuffers = new Map();
      sourceBuffers.set('ppg_waveform', {
        data: { sum: [1, 2, 3], count: [1, 1, 1] },
        conf: { sum: [0.8, 0.9, 1.0], count: [1, 1, 1] },
      });
      manager['buffers'].set('source1', sourceBuffers);

      const sourceNotes = new Map();
      sourceNotes.set('ppg_waveform', 'Initial PPG note');
      manager['notes'].set('source1', sourceNotes);
    });

    it('should update specific signal buffers using the generic logic', () => {
      const incData = [4, 5, 6];
      const incConf = [0.95, 0.96, 0.97];

      jest.spyOn(manager as any, 'getUpdatedSumCount');

      manager['updateSignalBuffer'](
        'source1',
        'ppg_waveform',
        incData,
        incConf,
        'incremental',
        0
      );
      manager['setNote']('source1', 'ppg_waveform', 'Updated PPG note');

      const updatedBuffer = manager['buffers']
        .get('source1')!
        .get('ppg_waveform');

      expect(updatedBuffer!.data.sum).toEqual([1, 2, 3, 4, 5, 6]);
      expect(updatedBuffer!.conf.sum).toEqual([0.8, 0.9, 1.0, 0.95, 0.96, 0.97]);

      const updatedNote = manager['notes'].get('source1')!.get('ppg_waveform');
      expect(updatedNote).toEqual('Updated PPG note');

      expect(manager['getUpdatedSumCount']).toHaveBeenCalledTimes(2);
    });
  });

  describe('assembleResult', () => {
    beforeEach(() => {
      methodConfig.supportedVitals = [
        'heart_rate',
        'ppg_waveform',
        'hrv_sdnn',
        'hrv_rmssd',
        'hrv_lfhf',
      ];

      const sourceBuffers = new Map();
      sourceBuffers.set('ppg_waveform', {
        data: { sum: [0, 0, 1, 2, 3], count: [1, 1, 1, 1, 1] },
        conf: { sum: [0.5, 0.6, 0.7, 0.8, 0.9], count: [1, 1, 1, 1, 1] },
      });
      sourceBuffers.set('respiratory_waveform', {
        data: { sum: [2, 3, 4, 5, 6], count: [1, 1, 1, 1, 1] },
        conf: { sum: [0.4, 0.5, 0.6, 0.7, 0.8], count: [1, 1, 1, 1, 1] },
      });
      manager['buffers'].set('source1', sourceBuffers);

      const notesMap = new Map();
      notesMap.set('ppg_waveform', 'PPG note');
      notesMap.set('respiratory_waveform', 'RESP note');
      manager['notes'].set('source1', notesMap);

      manager['timestamps'].set('source1', [1001, 1002, 1003, 1004, 1005]);
      manager['faces'].set('source1', {
        coordinates: [
          [0, 0, 20, 20],
          [0, 0, 20, 20],
          [0, 0, 20, 20],
          [10, 10, 30, 30],
          [15, 15, 25, 25],
        ],
        confidence: [0.9, 0.92, 0.95, 0.9, 0.85],
      });
      manager['message'].set('source1', 'Test message');

      mockedEstimateRateFromFFT.mockImplementation(
        (sig, fs, minFreq, maxFreq) => {
          if (maxFreq > 1.5) return 75; // HR
          return 18; // RR
        }
      );

      mockedEstimateHrv.mockImplementation((sig, fs, metric) => {
        switch (metric) {
          case 'sdnn':
            return { value: 30, confidence: [0.5, 0.6, 0.7, 0.8, 0.9] };
          case 'rmssd':
            return { value: 25, confidence: [0.5, 0.6, 0.7, 0.8, 0.9] };
          case 'lfhf':
            return { value: 1.5, confidence: [0.5, 0.6, 0.7, 0.8, 0.9] };
          default:
            return null;
        }
      });
    });

    it('should assemble an incremental result correctly', async () => {
      methodConfig.supportedVitals?.push(
        'respiratory_rate',
        'respiratory_waveform'
      );

      const incrementalResult: VitalLensResult = {
        time: [1004, 1005, 1006],
        display_time: 1007,
        face: {
          coordinates: [
            [20, 20, 40, 40],
            [20, 20, 40, 40],
            [25, 25, 50, 50],
          ],
          confidence: [0.91, 0.92, 0.93],
        },
        vital_signs: {
          ppg_waveform: {
            data: [1, 2, 3],
            confidence: [0.7, 0.8, 0.9],
            note: '',
            unit: '',
          },
          respiratory_waveform: {
            data: [4, 5, 6],
            confidence: [0.6, 0.7, 0.8],
            note: '',
            unit: '',
          },
        },
        message: '',
      };

      jest.spyOn(manager as any, 'getCurrentFps').mockReturnValue(1);

      const result = await (manager as any).assembleResult(
        'source1',
        'incremental',
        true,
        2,
        incrementalResult,
        1
      );

      const expectedResult: VitalLensResult = {
        time: [1006],
        display_time: 1007, // 1006 + 1
        face: {
          coordinates: [[25, 25, 50, 50]],
          confidence: [0.93],
          note: 'Face detection coordinates for this face, along with live confidence levels.',
        },
        vital_signs: {
          ppg_waveform: {
            data: [3],
            confidence: [0.9],
            unit: 'unitless',
            note: 'PPG note',
          },
          respiratory_waveform: {
            data: [6],
            confidence: [0.8],
            unit: 'unitless',
            note: 'RESP note',
          },
          heart_rate: {
            value: 75,
            confidence: 0.7, // avg of [0.5, 0.6, 0.7, 0.8, 0.9]
            unit: 'bpm',
            note: 'Estimate of the Heart Rate',
          },
          respiratory_rate: {
            value: 18,
            confidence: 0.6, // avg of [0.4, 0.5, 0.6, 0.7, 0.8]
            unit: 'bpm',
            note: 'Estimate of the Respiratory Rate',
          },
          hrv_sdnn: {
            value: 30,
            confidence: 0.5, // min of [0.5, 0.6, 0.7, 0.8, 0.9]
            unit: 'ms',
            note: 'Estimate of the Heart Rate Variability (SDNN)',
          },
          hrv_rmssd: {
            value: 25,
            confidence: 0.5, // min of [0.5, 0.6, 0.7, 0.8, 0.9]
            unit: 'ms',
            note: 'Estimate of the Heart Rate Variability (RMSSD)',
          },
          hrv_lfhf: {
            value: 1.5,
            confidence: 0.5, // min of [0.5, 0.6, 0.7, 0.8, 0.9]
            unit: 'ratio',
            note: 'Estimate of the Heart Rate Variability (LF/HF)',
          },
        },
        fps: 1,
        est_fps: 1,
        message: 'Test message',
      };

      expect(result).toEqual(expectedResult);
    });

    it('should assemble a windowed result correctly', async () => {
      methodConfig.supportedVitals?.push(
        'respiratory_rate',
        'respiratory_waveform'
      );
      jest.spyOn(manager as any, 'getCurrentFps').mockReturnValue(1);

      const result = await (manager as any).assembleResult(
        'source1',
        'windowed',
        false
      );

      const expectedResult: VitalLensResult = {
        time: [1002, 1003, 1004, 1005],
        face: {
          coordinates: [
            [0, 0, 20, 20],
            [0, 0, 20, 20],
            [10, 10, 30, 30],
            [15, 15, 25, 25],
          ],
          confidence: [0.92, 0.95, 0.9, 0.85],
          note: 'Face detection coordinates for this face, along with live confidence levels.',
        },
        vital_signs: {
          ppg_waveform: {
            data: [0, 1, 2, 3],
            confidence: [0.6, 0.7, 0.8, 0.9],
            unit: 'unitless',
            note: 'PPG note',
          },
          respiratory_waveform: {
            data: [3, 4, 5, 6],
            confidence: [0.5, 0.6, 0.7, 0.8],
            unit: 'unitless',
            note: 'RESP note',
          },
          heart_rate: {
            value: 75,
            confidence: 0.7,
            unit: 'bpm',
            note: 'Estimate of the Heart Rate',
          },
          respiratory_rate: {
            value: 18,
            confidence: 0.6,
            unit: 'bpm',
            note: 'Estimate of the Respiratory Rate',
          },
          hrv_sdnn: {
            value: 30,
            confidence: 0.5,
            unit: 'ms',
            note: 'Estimate of the Heart Rate Variability (SDNN)',
          },
          hrv_rmssd: {
            value: 25,
            confidence: 0.5,
            unit: 'ms',
            note: 'Estimate of the Heart Rate Variability (RMSSD)',
          },
          hrv_lfhf: {
            value: 1.5,
            confidence: 0.5,
            unit: 'ratio',
            note: 'Estimate of the Heart Rate Variability (LF/HF)',
          },
        },
        fps: 1,
        message: 'Test message',
      };

      expect(result).toEqual(expectedResult);
    });

    it('should assemble a complete result correctly', async () => {
      methodConfig.supportedVitals?.push(
        'respiratory_rate',
        'respiratory_waveform'
      );
      jest.spyOn(manager as any, 'getCurrentFps').mockReturnValue(1);

      const result = await (manager as any).assembleResult(
        'source1',
        'complete',
        false
      );

      const expectedResult: VitalLensResult = {
        time: [1001, 1002, 1003, 1004, 1005],
        face: {
          coordinates: [
            [0, 0, 20, 20],
            [0, 0, 20, 20],
            [0, 0, 20, 20],
            [10, 10, 30, 30],
            [15, 15, 25, 25],
          ],
          confidence: [0.9, 0.92, 0.95, 0.9, 0.85],
          note: 'Face detection coordinates for this face, along with live confidence levels.',
        },
        vital_signs: {
          ppg_waveform: {
            data: [0, 0, 1, 2, 3],
            confidence: [0.5, 0.6, 0.7, 0.8, 0.9],
            unit: 'unitless',
            note: 'PPG note',
          },
          respiratory_waveform: {
            data: [2, 3, 4, 5, 6],
            confidence: [0.4, 0.5, 0.6, 0.7, 0.8],
            unit: 'unitless',
            note: 'RESP note',
          },
          heart_rate: {
            value: 75,
            confidence: 0.7,
            unit: 'bpm',
            note: 'Estimate of the Heart Rate',
          },
          respiratory_rate: {
            value: 18,
            confidence: 0.6,
            unit: 'bpm',
            note: 'Estimate of the Respiratory Rate',
          },
          hrv_sdnn: {
            value: 30,
            confidence: 0.5,
            unit: 'ms',
            note: 'Estimate of the Heart Rate Variability (SDNN)',
          },
          hrv_rmssd: {
            value: 25,
            confidence: 0.5,
            unit: 'ms',
            note: 'Estimate of the Heart Rate Variability (RMSSD)',
          },
          hrv_lfhf: {
            value: 1.5,
            confidence: 0.5,
            unit: 'ratio',
            note: 'Estimate of the Heart Rate Variability (LF/HF)',
          },
        },
        fps: 1,
        message: 'Test message',
      };

      expect(result).toEqual(expectedResult);
      expect(mockedEstimateRateFromFFT).toHaveBeenCalled();
    });

    it('should calculate scalar value and confidence for provided non-waveform vitals (e.g. SpO2)', async () => {
      methodConfig.supportedVitals?.push('spo2');
      const sourceBuffers = manager['buffers'].get('source1')!;
      sourceBuffers.set('spo2', {
        data: { sum: [98, 99, 98, 99, 98], count: [1, 1, 1, 1, 1] },
        conf: { sum: [0.9, 0.9, 0.9, 0.9, 0.9], count: [1, 1, 1, 1, 1] },
      });
      manager['notes'].get('source1')!.set('spo2', 'SpO2 Note');
      const result = await (manager as any).assembleResult(
        'source1',
        'complete',
        false
      );
      expect((result.vital_signs as any).spo2).toEqual({
        value: 98.4,
        data: [98, 99, 98, 99, 98],
        confidence: 0.9,
        unit: '%',
        note: 'SpO2 Note',
      });
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

  describe('getResult', () => {
    it('should call assembleResult with "complete" mode', async () => {
      const assembleSpy = jest
        .spyOn(manager as any, 'assembleResult')
        .mockResolvedValue({});
      await manager.getResult('source1');
      expect(assembleSpy).toHaveBeenCalledWith('source1', 'complete', false);
    });
  });

  describe('getEmptyResult', () => {
    it('should return a predefined empty result object', () => {
      const result = manager.getEmptyResult();
      expect(result).toEqual({
        face: {},
        vital_signs: {},
        time: [],
        message: 'Prediction is empty because no face was detected.',
      });
    });
  });

  describe('reset', () => {
    it('should delete all data for a specific sourceId', () => {
      manager['timestamps'].set('source1', [1000]);
      manager['buffers'].set('source1', new Map());
      manager['timestamps'].set('source2', [2000]);
      manager['buffers'].set('source2', new Map());

      manager.reset('source1');

      expect(manager['timestamps'].has('source1')).toBe(false);
      expect(manager['buffers'].has('source1')).toBe(false);
      expect(manager['timestamps'].has('source2')).toBe(true);
      expect(manager['buffers'].has('source2')).toBe(true);
    });
  });

  describe('resetAll', () => {
    it('should clear all data from all maps', () => {
      manager['timestamps'].set('source1', [1000]);
      manager['buffers'].set('source1', new Map());

      manager.resetAll();

      expect(manager['timestamps'].size).toBe(0);
      expect(manager['buffers'].size).toBe(0);
    });
  });
});
