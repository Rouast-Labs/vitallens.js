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
      bufferOffset: 1,
      supportedVitals: ['heart_rate', 'ppg_waveform'],
    };
    options = {
      method: 'vitallens-2.0',
      overrideFpsTarget: 30,
    };
    session = new Session(mockCore, methodConfig, options);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('processIncrementalResult', () => {
    it('returns null if the incremental result has an empty time array', async () => {
      const result = await session.processIncrementalResult(
        { time: [] } as unknown as VitalLensResult,
        'incremental'
      );
      expect(result).toBeNull();
      expect(mockSessionInstance.processJs).not.toHaveBeenCalled();
    });

    it('returns null if returnResult flag is false, but still processes data', async () => {
      mockSessionInstance.processJs.mockReturnValueOnce({
        timestamp: [1000],
        message: '',
      });
      const result = await session.processIncrementalResult(
        { time: [1000] } as VitalLensResult,
        'incremental',
        false
      );
      expect(result).toBeNull();
      expect(mockSessionInstance.processJs).toHaveBeenCalled();
    });
  });

  describe('WaveformMode mapping', () => {
    beforeEach(() => {
      mockSessionInstance.processJs.mockReturnValue({
        timestamp: [1000],
        message: '',
      });
    });

    it('maps windowed mode to the Rust enum object format', async () => {
      await session.processIncrementalResult(
        { time: [1000] } as VitalLensResult,
        'windowed'
      );
      expect(mockSessionInstance.processJs).toHaveBeenCalledWith(
        expect.any(Object),
        { Windowed: { seconds: 10.0 } }
      );
    });

    it('maps global mode to the Global string', async () => {
      await session.processIncrementalResult(
        { time: [1000] } as VitalLensResult,
        'global'
      );
      expect(mockSessionInstance.processJs).toHaveBeenCalledWith(
        expect.any(Object),
        'Global'
      );
    });

    it('maps incremental mode to the Incremental string', async () => {
      await session.processIncrementalResult(
        { time: [1000] } as VitalLensResult,
        'incremental'
      );
      expect(mockSessionInstance.processJs).toHaveBeenCalledWith(
        expect.any(Object),
        'Incremental'
      );
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

    it('fetches a global result correctly via getResult', async () => {
      mockSessionInstance.processJs.mockReturnValueOnce({
        timestamp: [1000, 1001],
        message: 'Final global result',
        vitals: {},
        waveforms: {}
      });

      const result = await session.getResult();
      
      expect(mockSessionInstance.processJs).toHaveBeenCalledWith(
        { timestamp: [], signals: {} },
        'Global'
      );
      expect(result.time).toEqual([1000, 1001]);
      expect(result.message).toBe('Final global result');
    });
  });
});