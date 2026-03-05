import {
  toSessionConfig,
  toSessionInput,
  toVitalLensResult,
} from '../../src/processing/SessionAdapter';
import { MethodConfig, VitalLensResult } from '../../src/types/core';
import { describe, expect, it } from 'vitest';

describe('SessionAdapter', () => {
  describe('toSessionConfig', () => {
    it('maps MethodConfig to Wasm SessionConfig correctly', () => {
      const methodConfig: MethodConfig = {
        method: 'vitallens-2.0',
        roiMethod: 'face',
        fpsTarget: 30,
        inputSize: 40,
        minWindowLength: 10,
        maxWindowLength: 10,
        minWindowLengthState: 16,
        requiresState: false,
        bufferOffset: 1,
        supportedVitals: ['heart_rate', 'ppg_waveform', 'respiratory_rate'],
      };

      const config = toSessionConfig(methodConfig);

      expect(config.model_name).toBe('vitallens-2.0');
      expect(config.fps_target).toBe(30);
      expect(config.input_size).toBe(40);
      expect(config.n_inputs).toBe(16);
      expect(config.roi_method).toBe('face');
      expect(config.supported_vitals).toEqual([
        'heart_rate',
        'ppg_waveform',
        'respiratory_rate',
      ]);
      // Should filter supported vitals to only include waveforms
      expect(config.return_waveforms).toEqual(['ppg_waveform']);
    });

    it('overrides fps_target when provided', () => {
      const methodConfig = {
        method: 'pos',
        fpsTarget: 30,
        roiMethod: 'face',
        supportedVitals: [],
      } as unknown as MethodConfig;

      const config = toSessionConfig(methodConfig, 15);
      expect(config.fps_target).toBe(15);
    });
  });

  describe('toSessionInput', () => {
    it('maps VitalLensResult to Wasm SessionInput correctly', () => {
      const input: VitalLensResult = {
        time: [1000, 1001],
        face: {
          coordinates: [
            [0, 0, 20, 20],
            [1, 1, 21, 21],
          ],
          confidence: [0.9, 0.95],
        },
        vitals: {},
        waveforms: {
          ppg_waveform: {
            data: [0.1, 0.2],
            confidence: [0.8, 0.85],
            unit: 'unitless',
            note: '',
          },
        },
        message: 'ok',
      };

      const sessionInput = toSessionInput(input);

      expect(sessionInput.timestamp).toEqual([1000, 1001]);
      expect(sessionInput.face.coordinates).toEqual([
        [0, 0, 20, 20],
        [1, 1, 21, 21],
      ]);
      expect(sessionInput.face.confidence).toEqual([0.9, 0.95]);
      expect(sessionInput.signals.ppg_waveform).toEqual({
        data: [0.1, 0.2],
        confidence: [0.8, 0.85],
      });
    });

    it('expands scalar confidence into an array', () => {
      const input: VitalLensResult = {
        time: [1000, 1001],
        face: {},
        vitals: {},
        waveforms: {
          ppg_waveform: {
            data: [0.1, 0.2],
            confidence: 0.99 as any,  
            unit: 'unitless',
            note: '',
          },
        },
        message: '',
      };

      const sessionInput = toSessionInput(input);
      expect(sessionInput.signals.ppg_waveform.confidence).toEqual([
        0.99, 0.99,
      ]);
    });

    it('handles empty or missing data gracefully', () => {
      const input: VitalLensResult = {
        vitals: {},
        waveforms: {},
        face: {},
        message: '',
      };

      const sessionInput = toSessionInput(input);
      expect(sessionInput.timestamp).toEqual([]);
      expect(sessionInput.face).toBeUndefined();
      expect(sessionInput.signals).toEqual({});
    });
  });

  describe('toVitalLensResult', () => {
    it('maps Wasm output back to VitalLensResult correctly', () => {
      const wasmResult = {
        timestamp: [1000, 1001],
        face: {
          coordinates: [
            [0, 0, 20, 20],
            [1, 1, 21, 21],
          ],
          confidence: [0.9, 0.95],
          note: 'face note',
        },
        waveforms: new Map([
          [
            'ppg_waveform',
            {
              data: [0.5, 0.6],
              confidence: [0.8, 0.85],
              unit: 'unitless',
              note: 'wf note',
            },
          ],
        ]),
        vitals: new Map([
          [
            'heart_rate',
            { value: 72, confidence: 0.9, unit: 'bpm', note: 'hr note' },
          ],
        ]),
        fps: 30.0,
        message: 'Success',
      };

      const incrementalResult: VitalLensResult = {
        time: [1000, 1001],
        face: {},
        vitals: {},
        waveforms: {},
        message: 'incremental msg',
        model_used: 'test-model',
      };

      const result = toVitalLensResult(wasmResult, incrementalResult);

      expect(result.time).toEqual([1000, 1001]);
      expect(result.message).toBe('Success');
      expect(result.model_used).toBe('test-model');
      expect(result.fps).toBe(30.0);

      expect(result.face.coordinates).toEqual([
        [0, 0, 20, 20],
        [1, 1, 21, 21],
      ]);

      expect(result.waveforms.ppg_waveform).toEqual({
        data: [0.5, 0.6],
        confidence: [0.8, 0.85],
        unit: 'unitless',
        note: 'wf note',
      });

      expect(result.vitals.heart_rate).toEqual({
        value: 72,
        confidence: 0.9,
        unit: 'bpm',
        note: 'hr note',
      });
    });

    it('falls back to incremental data if Wasm result lacks data', () => {
      const wasmResult = {
        timestamp: [],
        message: '',
      };

      const incrementalResult: VitalLensResult = {
        time: [999],
        face: { confidence: [1.0] },
        vitals: {},
        waveforms: {},
        message: 'fallback msg',
        fps: 15.0,
      };

      const result = toVitalLensResult(wasmResult, incrementalResult);
      expect(result.time).toEqual([999]);
      expect(result.message).toBe('fallback msg');
      expect(result.fps).toBe(15.0);
      expect(result.face.confidence).toEqual([1.0]);
    });
  });
});
