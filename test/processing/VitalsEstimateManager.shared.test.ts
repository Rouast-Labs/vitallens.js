/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { VitalsEstimateManager } from '../../src/processing/VitalsEstimateManager';
import {
  MethodConfig,
  VitalLensOptions,
  VitalLensResult,
} from '../../src/types/core';
import { getCore } from '../../src/core/wasmProvider';
import {
  describe,
  beforeAll,
  expect,
  beforeEach,
  afterEach,
  vi,
  it,
} from 'vitest';

// Mock the Wasm core
const mockSessionInstance = {
  processJs: vi.fn(),
  reset: vi.fn(),
};

vi.mock('../../src/core/wasmProvider', () => {
  const mockCore = {
    Session: class {
      constructor() {
        return mockSessionInstance;
      }
    },
  };
  return {
    getCore: vi.fn().mockResolvedValue(mockCore),
  };
});

describe('VitalsEstimateManager', () => {
  let methodConfig: MethodConfig;
  let options: VitalLensOptions;
  let manager: VitalsEstimateManager;

  beforeAll(async () => {
    await getCore(); // Ensure the module-level 'core' variable is populated
  });

  beforeEach(() => {
    methodConfig = {
      method: 'vitallens-2.0',
      roiMethod: 'face',
      fpsTarget: 30,
      minWindowLength: 10,
      maxWindowLength: 10,
      requiresState: false,
      bufferOffset: 1,
      supportedVitals: ['heart_rate', 'ppg_waveform'],
    };
    options = {
      method: 'vitallens-2.0',
      overrideFpsTarget: 30,
      waveformMode: 'windowed',
    };
    manager = new VitalsEstimateManager(() => methodConfig, options);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('processIncrementalResult', () => {
    it('initializes a Wasm Session and translates inputs and outputs correctly', async () => {
      // Fake input from the API
      const incrementalResult: VitalLensResult = {
        time: [1000, 1001],
        face: {
          coordinates: [
            [0, 0, 20, 20],
            [1, 1, 21, 21],
          ],
          confidence: [0.9, 0.95],
        },
        vital_signs: {
          ppg_waveform: {
            data: [0.1, 0.2],
            confidence: [0.8, 0.85],
            unit: 'unitless',
            note: '',
          },
        },
        message: 'ok',
      };

      // Fake output returned from Wasm processJs
      mockSessionInstance.processJs.mockReturnValueOnce({
        timestamp: [1000, 1001],
        face: {
          coordinates: [
            [0, 0, 20, 20],
            [1, 1, 21, 21],
          ],
          confidence: [0.9, 0.95],
          note: 'face note',
        },
        waveforms: {
          ppg_waveform: {
            data: [0.5, 0.6],
            confidence: [0.8, 0.85],
            unit: 'unitless',
            note: 'wf note',
          },
        },
        vitals: {
          heart_rate: {
            value: 72,
            confidence: 0.9,
            unit: 'bpm',
            note: 'hr note',
          },
        },
        fps: 30.0,
        message: 'Success',
      });

      const result = await manager.processIncrementalResult(
        incrementalResult,
        'source1',
        'incremental'
      );

      // 1. Verify processJs was called with the right mapped input structure
      expect(mockSessionInstance.processJs).toHaveBeenCalledWith(
        {
          face: {
            coordinates: [
              [0, 0, 20, 20],
              [1, 1, 21, 21],
            ],
            confidence: [0.9, 0.95],
          },
          signals: {
            ppg_waveform: { data: [0.1, 0.2], confidence: [0.8, 0.85] },
          },
          timestamp: [1000, 1001],
        },
        { Windowed: 10.0 } // Because options.waveformMode = 'windowed' overrides default
      );

      // 2. Verify the output was mapped back to VitalLensResult correctly
      expect(result).toBeDefined();
      expect(result!.time).toEqual([1000, 1001]);
      expect(result!.vital_signs.heart_rate).toEqual({
        value: 72,
        confidence: 0.9,
        unit: 'bpm',
        note: 'hr note',
      });
      expect(result!.vital_signs.ppg_waveform).toEqual({
        data: [0.5, 0.6],
        confidence: [0.8, 0.85],
        unit: 'unitless',
        note: 'wf note',
      });
    });

    it('returns null if time array is empty', async () => {
      const result = await manager.processIncrementalResult(
        { time: [], vital_signs: {}, face: {}, message: '' },
        'source1',
        'incremental'
      );
      expect(result).toBeNull();
      expect(mockSessionInstance.processJs).not.toHaveBeenCalled();
    });
  });

  describe('produceBufferedResults', () => {
    it('unrolls a multi-frame result into an array of single-frame results', async () => {
      const incrementalResult: VitalLensResult = {
        time: [1000, 1001],
        vital_signs: {},
        face: {},
        message: '',
      };

      // Mock processJs to return a 2-frame result
      mockSessionInstance.processJs.mockReturnValueOnce({
        timestamp: [1000, 1001],
        face: {
          coordinates: [
            [0, 0, 1, 1],
            [2, 2, 3, 3],
          ],
          confidence: [0.9, 0.9],
        },
        waveforms: {
          ppg_waveform: { data: [0.5, 0.6], confidence: [0.8, 0.8] },
        },
        vitals: {
          heart_rate: { value: 60, confidence: 0.9 },
        },
      });

      const results = await manager.produceBufferedResults(
        incrementalResult,
        'source1',
        'windowed'
      );

      expect(results).toBeDefined();
      expect(results).toHaveLength(2);

      // Check first frame
      expect(results![0].time).toEqual([1000]);
      expect(results![0].face.coordinates).toEqual([[0, 0, 1, 1]]);
      expect(results![0].vital_signs.ppg_waveform.data).toEqual([0.5]);
      // Scalar vital should only appear on the LAST frame of the buffer
      expect(results![0].vital_signs.heart_rate).toBeUndefined();

      // Check second frame
      expect(results![1].time).toEqual([1001]);
      expect(results![1].face.coordinates).toEqual([[2, 2, 3, 3]]);
      expect(results![1].vital_signs.ppg_waveform.data).toEqual([0.6]);
      // Scalar vital appears here
      expect(results![1].vital_signs.heart_rate).toBeDefined();
      expect(results![1].vital_signs.heart_rate!.value).toBe(60);
    });
  });

  describe('getResult', () => {
    it('calls processJs with empty inputs and Global mode to flush final state', async () => {
      mockSessionInstance.processJs.mockReturnValueOnce({
        timestamp: [1000],
        vitals: { heart_rate: { value: 70, confidence: 1.0 } },
      });

      const result = await manager.getResult('source1');

      expect(mockSessionInstance.processJs).toHaveBeenCalledWith(
        { timestamp: [], signals: {} },
        'Global'
      );
      expect(result.time).toEqual([1000]);
      expect(result.vital_signs.heart_rate!.value).toBe(70);
    });
  });

  describe('reset and getEmptyResult', () => {
    it('calls session reset for a specific source', async () => {
      // Provide a dummy return value so mapWasmResultToVitalLensResult doesn't crash
      mockSessionInstance.processJs.mockReturnValueOnce({
        timestamp: [],
        waveforms: {},
        vitals: {},
      });

      // trigger creation
      await manager.getResult('source1');
      manager.reset('source1');
      expect(mockSessionInstance.reset).toHaveBeenCalled();
    });

    it('calls session reset for all sources', async () => {
      mockSessionInstance.processJs.mockReturnValue({
        timestamp: [],
        waveforms: {},
        vitals: {},
      });

      // trigger creation for two sources
      await manager.getResult('source1');
      await manager.getResult('source2');

      manager.resetAll();

      // Should have been called at least twice (once for each source)
      expect(mockSessionInstance.reset).toHaveBeenCalledTimes(2);
    });

    it('returns a standard empty result', () => {
      expect(manager.getEmptyResult()).toEqual({
        face: {},
        vital_signs: {},
        time: [],
        message: 'Prediction is empty because no face was detected.',
      });
    });
  });
});
