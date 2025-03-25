/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { VitalsEstimateManager } from '../../src/processing/VitalsEstimateManager';
import {
  MethodConfig,
  VitalLensOptions,
  VitalLensResult,
} from '../../src/types/core';
import { jest } from '@jest/globals';

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
}));

const dummyPostprocessFn = (
  signalType: 'ppg' | 'resp',
  data: number[],
  fps: number
): number[] => {
  return data;
};

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
      requiresState: false,
      bufferOffset: 1,
    };
    options = {
      method: 'g',
      overrideFpsTarget: 1,
      waveformMode: 'windowed',
    };
    // Note the new third parameter (postprocessFn)
    manager = new VitalsEstimateManager(
      methodConfig,
      options,
      dummyPostprocessFn
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with the correct buffer sizes based on fpsTarget and constants', () => {
      expect(manager).toHaveProperty('fpsTarget', 1);
      expect(manager).toHaveProperty('bufferSizeAgg', 1 * 4); // AGG_WINDOW_SIZE = 4 (per mock)
      expect(manager).toHaveProperty('bufferSizePpg', 1 * 10); // CALC_HR_WINDOW_SIZE = 10
      expect(manager).toHaveProperty('bufferSizeResp', 1 * 30); // CALC_RR_WINDOW_SIZE = 30
      expect(manager).toHaveProperty('minBufferSizePpg', 1 * 2); // CALC_HR_MIN_WINDOW_SIZE = 2
      expect(manager).toHaveProperty('minBufferSizeResp', 1 * 4); // CALC_RR_MIN_WINDOW_SIZE = 4
    });
  });

  describe('processIncrementalResult', () => {
    beforeEach(() => {
      jest
        .spyOn(manager as any, 'updateWaveforms')
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

    it('should throw an error if no waveform data is provided', async () => {
      await expect(
        manager.processIncrementalResult(
          { face: {}, vital_signs: {}, time: [], message: '' },
          'sourceId',
          'complete'
        )
      ).rejects.toThrow('No waveform data found in incremental result.');
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

      expect(manager['timestamps'].has('source1')).toBe(true);
      expect(manager['waveforms'].has('source1')).toBe(true);
      expect(manager['updateTimestamps']).toHaveBeenCalledWith(
        'source1',
        incrementalResult.time,
        'windowed',
        0
      );
      expect(manager['updateWaveforms']).toHaveBeenCalledWith(
        'source1',
        incrementalResult.vital_signs,
        'windowed',
        0
      );
    });

    it('should update timestamps and waveforms', async () => {
      manager['timestamps'].set(
        'source1',
        [996, 997, 998, 999, 1000, 1001, 1002, 1003, 1004, 1005]
      );
      manager['faces'].set('source1', {
        coordinates: [
          [0, 0, 20, 20],
          [0, 0, 20, 20],
          [0, 0, 20, 20],
          [0, 0, 20, 20],
          [0, 0, 20, 20],
          [0, 0, 20, 20],
        ],
        confidence: [0.9, 0.9, 0.9, 0.9, 0.9, 0.9],
      });
      manager['waveforms'].set('source1', {
        ppgData: {
          sum: [1, 2, 3, 4, 5, 6],
          count: [1, 1, 1, 1, 1, 1],
        },
        ppgConf: {
          sum: [0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
          count: [1, 1, 1, 1, 1, 1],
        },
        respData: {
          sum: [4, 5, 6, 7, 8, 9],
          count: [1, 1, 1, 1, 1, 1],
        },
        respConf: {
          sum: [0.7, 0.7, 0.7, 0.7, 0.7, 0.7],
          count: [1, 1, 1, 1, 1, 1],
        },
      });

      const incrementalResult = {
        time: [1001, 1002, 1003, 1004, 1005, 1006],
        vital_signs: {
          ppg_waveform: {
            data: [1, 2, 3, 4, 5, 6],
            confidence: [0.9, 0.9, 0.9, 0.9, 0.9, 0.9],
            unit: '',
            note: '',
          },
          respiratory_waveform: {
            data: [4, 5, 6, 7, 8, 9],
            confidence: [0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
            unit: '',
            note: '',
          },
        },
        face: {
          coordinates: [
            [0, 0, 20, 20],
            [0, 0, 20, 20],
            [0, 0, 20, 20],
            [0, 0, 20, 20],
            [0, 0, 20, 20],
            [0, 0, 20, 20],
          ] as Array<[number, number, number, number]>,
          confidence: [0.95, 0.95, 0.95, 0.95, 0.95, 0.95],
        },
        message: '',
      };

      const result = await manager.processIncrementalResult(
        incrementalResult,
        'source1',
        'complete'
      );

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
      expect(manager['updateWaveforms']).toHaveBeenCalledWith(
        'source1',
        incrementalResult.vital_signs,
        options.waveformMode!,
        5
      );
    });
  });

  // TODO: Test produceBufferedResults

  describe('getUpdatedValues', () => {
    it('should append new values when there is no overlap', () => {
      const currentValues = [1, 2, 3];
      const newValues = [4, 5, 6];
      const result = manager['getUpdatedValues'](
        currentValues,
        newValues,
        'incremental',
        0
      );
      expect(result).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('should handle overlap correctly and update the array', () => {
      const currentValues = [1, 2, 3, 4, 5];
      const newValues = [4, 5, 6, 7, 8];
      const result = manager['getUpdatedValues'](
        currentValues,
        newValues,
        'incremental',
        2
      );
      expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it('should trim the array to the maximum buffer size in non-complete mode', () => {
      const currentValues = [1, 2, 3, 4, 5];
      const newValues = [6, 7, 8, 9, 10];
      manager['bufferSizePpg'] = 8;
      manager['bufferSizeResp'] = 8;
      const result = manager['getUpdatedValues'](
        currentValues,
        newValues,
        'windowed',
        0
      );
      expect(result).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it('should keep all values in complete mode regardless of buffer size', () => {
      const currentValues = [1, 2, 3, 4, 5];
      const newValues = [6, 7, 8, 9, 10];
      manager['bufferSizePpg'] = 8;
      manager['bufferSizeResp'] = 8;
      const result = manager['getUpdatedValues'](
        currentValues,
        newValues,
        'complete',
        0
      );
      expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
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
      jest
        .spyOn(manager as any, 'getUpdatedValues')
        .mockReturnValue([1000, 1001, 1002, 1003, 1004, 1005]);

      manager['updateTimestamps']('source1', newTimestamps, 'incremental', 1);

      const updatedTimestamps = manager['timestamps'].get('source1');
      expect(updatedTimestamps).toEqual([1000, 1001, 1002, 1003, 1004, 1005]);
      expect(manager['getUpdatedValues']).toHaveBeenCalledWith(
        [1000, 1001, 1002, 1003],
        newTimestamps,
        'incremental',
        1
      );
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
      manager['faceNote'].set('source1', 'Initial face note');
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
      jest.spyOn(manager as any, 'getUpdatedValues').mockReturnValueOnce([
        [0, 0, 20, 20],
        [10, 10, 30, 30],
        [15, 15, 25, 25],
        [20, 20, 40, 40],
      ]);
      jest
        .spyOn(manager as any, 'getUpdatedValues')
        .mockReturnValueOnce([0.8, 0.9, 0.95, 0.99]);

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
      expect(manager['getUpdatedValues']).toHaveBeenCalledWith(
        [
          [0, 0, 20, 20],
          [10, 10, 30, 30],
        ],
        newFaces.coordinates,
        'incremental',
        0
      );
      expect(manager['getUpdatedValues']).toHaveBeenCalledWith(
        [0.8, 0.9],
        newFaces.confidence,
        'incremental',
        0
      );
    });

    it('should not update faces if newFaces is missing confidence or coordinates', () => {
      const newFaces = { coordinates: undefined, confidence: undefined };
      manager['updateFaces']('source1', newFaces as any, 'incremental', 0);

      const updatedFaces = manager['faces'].get('source1');
      expect(updatedFaces).toEqual({
        coordinates: [
          [0, 0, 20, 20],
          [10, 10, 30, 30],
        ],
        confidence: [0.8, 0.9],
      });
    });

    it('should update the face note only if provided', () => {
      const newFaces = {
        coordinates: [[15, 15, 25, 25]],
        confidence: [0.95],
      };
      manager['updateFaces']('source1', newFaces as any, 'incremental', 0);

      expect(manager['faceNote'].get('source1')).toEqual('Initial face note');
    });
  });

  describe('updateWaveforms', () => {
    beforeEach(() => {
      manager['waveforms'].set('source1', {
        ppgData: { sum: [1, 2, 3], count: [1, 1, 1] },
        ppgConf: { sum: [0.8, 0.9, 1.0], count: [1, 1, 1] },
        respData: { sum: [4, 5, 6], count: [1, 1, 1] },
        respConf: { sum: [0.7, 0.8, 0.9], count: [1, 1, 1] },
      });
      manager['waveformNotes'].set('source1', {
        ppg: 'Initial PPG note',
        resp: 'Initial RESP note',
      });
    });

    it('should update waveform buffers and notes correctly', () => {
      const newVitals = {
        ppg_waveform: {
          data: [4, 5, 6],
          confidence: [0.95, 0.96, 0.97],
          unit: '',
          note: 'Updated PPG note',
        },
        respiratory_waveform: {
          data: [7, 8, 9],
          confidence: [0.75, 0.76, 0.77],
          unit: '',
          note: 'Updated RESP note',
        },
      };

      jest
        .spyOn(manager as any, 'getUpdatedSumCount')
        .mockReturnValueOnce({
          sum: [1, 2, 3, 4, 5, 6],
          count: [1, 1, 1, 1, 1, 1],
        }) // For ppgData
        .mockReturnValueOnce({
          sum: [0.8, 0.9, 1.0, 0.95, 0.96, 0.97],
          count: [1, 1, 1, 1, 1, 1],
        }) // For ppgConf
        .mockReturnValueOnce({
          sum: [4, 5, 6, 7, 8, 9],
          count: [1, 1, 1, 1, 1, 1],
        }) // For respData
        .mockReturnValueOnce({
          sum: [0.7, 0.8, 0.9, 0.75, 0.76, 0.77],
          count: [1, 1, 1, 1, 1, 1],
        }); // For respConf

      manager['updateWaveforms']('source1', newVitals, 'incremental', 0);

      const updatedWaveforms = manager['waveforms'].get('source1');
      expect(updatedWaveforms).toEqual({
        ppgData: { sum: [1, 2, 3, 4, 5, 6], count: [1, 1, 1, 1, 1, 1] },
        ppgConf: {
          sum: [0.8, 0.9, 1.0, 0.95, 0.96, 0.97],
          count: [1, 1, 1, 1, 1, 1],
        },
        respData: { sum: [4, 5, 6, 7, 8, 9], count: [1, 1, 1, 1, 1, 1] },
        respConf: {
          sum: [0.7, 0.8, 0.9, 0.75, 0.76, 0.77],
          count: [1, 1, 1, 1, 1, 1],
        },
      });

      const updatedNotes = manager['waveformNotes'].get('source1');
      expect(updatedNotes).toEqual({
        ppg: 'Updated PPG note',
        resp: 'Updated RESP note',
      });

      expect(manager['getUpdatedSumCount']).toHaveBeenCalledTimes(4);
    });

    it('should not update waveforms if no new data is provided', () => {
      manager['updateWaveforms']('source1', {}, 'incremental', 0);

      const updatedWaveforms = manager['waveforms'].get('source1');
      expect(updatedWaveforms).toEqual({
        ppgData: { sum: [1, 2, 3], count: [1, 1, 1] },
        ppgConf: { sum: [0.8, 0.9, 1.0], count: [1, 1, 1] },
        respData: { sum: [4, 5, 6], count: [1, 1, 1] },
        respConf: { sum: [0.7, 0.8, 0.9], count: [1, 1, 1] },
      });

      const updatedNotes = manager['waveformNotes'].get('source1');
      expect(updatedNotes).toEqual({
        ppg: 'Initial PPG note',
        resp: 'Initial RESP note',
      });
    });
  });

  describe('assembleResult', () => {
    beforeEach(() => {
      manager['waveforms'].set('source1', {
        ppgData: { sum: [0, 0, 1, 2, 3], count: [1, 1, 1, 1, 1] },
        ppgConf: { sum: [0.5, 0.6, 0.7, 0.8, 0.9], count: [1, 1, 1, 1, 1] },
        respData: { sum: [2, 3, 4, 5, 6], count: [1, 1, 1, 1, 1] },
        respConf: { sum: [0.4, 0.5, 0.6, 0.7, 0.8], count: [1, 1, 1, 1, 1] },
      });
      manager['waveformNotes'].set('source1', {
        ppg: 'PPG note',
        resp: 'RESP note',
      });
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
    });

    it('should assemble an incremental result correctly', async () => {
      const incrementalResult: VitalLensResult = {
        time: [1004, 1005, 1006],
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
      jest.spyOn(manager as any, 'estimateHeartRate').mockReturnValue(75);
      jest.spyOn(manager as any, 'estimateRespiratoryRate').mockReturnValue(18);

      const result = await manager['assembleResult'](
        'source1',
        'incremental',
        true,
        2,
        incrementalResult,
        1
      );

      expect(result).toEqual({
        time: [1006],
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
            confidence: 0.7,
            unit: 'bpm',
            note: 'Estimate of the heart rate.',
          },
          respiratory_rate: {
            value: 18,
            confidence: 0.6,
            unit: 'bpm',
            note: 'Estimate of the respiratory rate.',
          },
        },
        fps: 1,
        estFps: 1,
        message: 'Test message',
      });
    });

    it('should assemble an aggregated result correctly', async () => {
      jest.spyOn(manager as any, 'getCurrentFps').mockReturnValue(1);
      jest.spyOn(manager as any, 'estimateHeartRate').mockReturnValue(75);
      jest.spyOn(manager as any, 'estimateRespiratoryRate').mockReturnValue(18);

      const result = await manager['assembleResult'](
        'source1',
        'windowed',
        false
      );

      expect(result).toEqual({
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
            note: 'Estimate of the heart rate.',
          },
          respiratory_rate: {
            value: 18,
            confidence: 0.6,
            unit: 'bpm',
            note: 'Estimate of the respiratory rate.',
          },
        },
        fps: 1,
        message: 'Test message',
      });
      expect(manager['getCurrentFps']).toHaveBeenCalledWith(
        'source1',
        manager['bufferSizeAgg']
      );
    });

    it('should assemble a complete result correctly', async () => {
      jest.spyOn(manager as any, 'getCurrentFps').mockReturnValue(1);
      jest.spyOn(manager as any, 'estimateHeartRate').mockReturnValue(75);
      jest.spyOn(manager as any, 'estimateRespiratoryRate').mockReturnValue(18);

      const result = await manager['assembleResult'](
        'source1',
        'complete',
        false
      );

      expect(result).toEqual({
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
            note: 'Estimate of the heart rate.',
          },
          respiratory_rate: {
            value: 18,
            confidence: 0.6,
            unit: 'bpm',
            note: 'Estimate of the respiratory rate.',
          },
        },
        fps: 1,
        message: 'Test message',
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

  describe('estimateRateFromFFT', () => {
    it('should throw an error if the waveform is empty', () => {
      expect(() => {
        manager['estimateRateFromFFT']([], 30, 0.5, 3.5);
      }).toThrowError(
        'Invalid waveform data, sampling frequency, or frequency range.'
      );
    });

    it('should throw an error if samplingFrequency is non-positive', () => {
      expect(() => {
        manager['estimateRateFromFFT']([1, 2, 3], 0, 0.5, 3.5);
      }).toThrowError(
        'Invalid waveform data, sampling frequency, or frequency range.'
      );
    });

    it('should throw an error if minFrequency is greater than or equal to maxFrequency', () => {
      expect(() => {
        manager['estimateRateFromFFT']([1, 2, 3], 30, 3.5, 0.5);
      }).toThrowError(
        'Invalid waveform data, sampling frequency, or frequency range.'
      );
    });

    it('should correctly estimate the dominant frequency within the range', () => {
      const waveform = [0, 1, 0, -1, 0, 1, 0, -1]; // 2 Hz dominant frequency
      const samplingFrequency = 8; // Sampling rate in Hz
      const result = manager['estimateRateFromFFT'](
        waveform,
        samplingFrequency,
        0.5,
        3
      ); // Frequency range includes 1 Hz
      expect(result).toBeCloseTo(2 * 60, 0.1); // Expected: 2 Hz = 120 BPM
    });

    it('should estimate the frequency with higher resolution when desiredResolutionHz is specified', () => {
      // Generate a sine wave with a frequency of 1.25 Hz sampled at 30 Hz
      const frequency = 1.25; // Frequency in Hz
      const samplingFrequency = 30; // Sampling rate in Hz
      const duration = 3; // Duration in seconds
      const numSamples = samplingFrequency * duration;
      const waveform = Array.from({ length: numSamples }, (_, i) =>
        Math.sin((2 * Math.PI * frequency * i) / samplingFrequency)
      );

      const minFrequency = 1.0; // Minimum frequency in Hz
      const maxFrequency = 2.0; // Maximum frequency in Hz
      const desiredResolutionHz = 0.001; // Higher resolution in Hz

      const result = manager['estimateRateFromFFT'](
        waveform,
        samplingFrequency,
        minFrequency,
        maxFrequency,
        desiredResolutionHz
      );

      // Expect the result to be close to 75 BPM (1.25 Hz * 60 seconds)
      expect(result).toBeCloseTo(75, 0.1);
    });

    it('should handle a waveform with multiple frequencies and return the most dominant within the range', () => {
      const waveform = Array.from(
        { length: 128 },
        (_, n) =>
          Math.sin((2 * Math.PI * 1 * n) / 128) +
          0.5 * Math.sin((2 * Math.PI * 3 * n) / 128)
      ); // Mixture of 1 Hz and 3 Hz
      const samplingFrequency = 128; // Sampling rate in Hz
      const result = manager['estimateRateFromFFT'](
        waveform,
        samplingFrequency,
        0.5,
        2
      ); // Frequency range includes only 1 Hz
      expect(result).toBeCloseTo(1 * 60, 1); // Expected: 1 Hz = 60 BPM
    });
  });
});
