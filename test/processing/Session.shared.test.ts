import { Session } from '../../src/processing/Session';
import {
  MethodConfig,
  VitalLensOptions,
  VitalLensResult,
} from '../../src/types/core';
import { describe, expect, beforeEach, afterEach, vi, it } from 'vitest';

const mockSessionInstance = {
  processJs: vi.fn(),
  reset: vi.fn(),
};

const mockCore = {
  Session: class {
    constructor() {
      return mockSessionInstance;
    }
  },
};

describe('Session', () => {
  let methodConfig: MethodConfig;
  let options: VitalLensOptions;
  let session: Session;

  beforeEach(() => {
    methodConfig = {
      method: 'vitallens-2.0',
      roiMethod: 'face',
      fpsTarget: 30,
      minWindowLength: 10,
      maxWindowLength: 10,
      requiresState: false,
      bufferOffset: 1, // display_time offset
      supportedVitals: ['heart_rate', 'ppg_waveform'],
    };
    options = {
      method: 'vitallens-2.0',
      overrideFpsTarget: 30,
      waveformMode: 'windowed',
    };
    session = new Session(mockCore, methodConfig, options);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('produceBufferedResults', () => {
    it('unrolls a batched result into individual frames for UI rendering', async () => {
      const incrementalResult = { time: [1000, 1001] } as VitalLensResult;

      // Mock the internal call to processIncrementalResult to bypass adapter/core logic
      vi.spyOn(session, 'processIncrementalResult').mockResolvedValueOnce({
        time: [1000, 1001],
        face: {
          coordinates: [
            [0, 0, 1, 1],
            [2, 2, 3, 3],
          ],
          confidence: [0.9, 0.8],
        },
        vital_signs: {
          ppg_waveform: {
            data: [0.5, 0.6],
            confidence: [0.8, 0.85],
            unit: 'unitless',
            note: '',
          },
          heart_rate: { value: 60, confidence: 0.9, unit: 'bpm', note: '' },
        },
        message: 'Success',
      });

      const results = await session.produceBufferedResults(
        incrementalResult,
        'windowed'
      );

      expect(results).toHaveLength(2);

      // Frame 1: Should have array values at index 0, and no scalar values
      expect(results![0].time).toEqual([1000]);
      expect(results![0].display_time).toBe(1001); // 1000 + bufferOffset (1)
      expect(results![0].face.coordinates).toEqual([[0, 0, 1, 1]]);
      expect(results![0].vital_signs.ppg_waveform?.data).toEqual([0.5]);
      expect(results![0].vital_signs.heart_rate).toBeUndefined(); 

      // Frame 2: Should have array values at index 1, and the scalar values attached
      expect(results![1].time).toEqual([1001]);
      expect(results![1].display_time).toBe(1002); // 1001 + bufferOffset (1)
      expect(results![1].face.coordinates).toEqual([[2, 2, 3, 3]]);
      expect(results![1].vital_signs.ppg_waveform?.data).toEqual([0.6]);
      expect(results![1].vital_signs.heart_rate?.value).toBe(60); 
    });
  });

  describe('Lifecycle and Delegation', () => {
    it('calls session reset on the core instance', () => {
      session.reset();
      expect(mockSessionInstance.reset).toHaveBeenCalled();
    });

    it('returns a standard empty result', () => {
      expect(session.getEmptyResult().message).toContain(
        'empty because no face was detected'
      );
    });
  });
});
