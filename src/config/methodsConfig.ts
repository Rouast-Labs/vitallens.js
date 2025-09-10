import { MethodConfig } from '../types';

export const METHODS_CONFIG: Record<string, MethodConfig> = {
  pos: {
    method: 'pos',
    roiMethod: 'face',
    fpsTarget: 30,
    minWindowLength: 48,
    maxWindowLength: 48,
    requiresState: false,
    bufferOffset: 0,
    supportedVitals: ['ppg_waveform', 'heart_rate'],
  },
  chrom: {
    method: 'chrom',
    roiMethod: 'face',
    fpsTarget: 30,
    minWindowLength: 48,
    maxWindowLength: 48,
    requiresState: false,
    bufferOffset: 0,
    supportedVitals: ['ppg_waveform', 'heart_rate'],
  },
  g: {
    method: 'g',
    roiMethod: 'face',
    fpsTarget: 30,
    minWindowLength: 64,
    maxWindowLength: 64,
    requiresState: false,
    bufferOffset: 0,
    supportedVitals: ['ppg_waveform', 'heart_rate'],
  },
};
