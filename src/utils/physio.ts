import FFT from 'fft.js';
import {
  CALC_HR_MAX,
  CALC_HR_MIN,
  CALC_RR_MAX,
  CALC_RR_MIN,
  HRV_HF_BAND,
  HRV_LF_BAND,
} from '../config/constants';
import { standardize } from '../utils/arrayOps';
import { VitalLensResult } from '../types';

// TODO: Test-driven implementation of the below
// TODO: Consider moving to its own lib

/**
 * Finds peaks in a 1D signal.
 * @param signal The input signal array.
 * @returns An array of indices corresponding to the peaks.
 */
function findPeaks(signal: number[]): number[] {
  const peaks: number[] = [];
  for (let i = 1; i < signal.length - 1; i++) {
    if (signal[i] > signal[i - 1] && signal[i] > signal[i + 1]) {
      peaks.push(i);
    }
  }
  return peaks;
}

/**
 * Calculates R-R intervals in milliseconds from a PPG signal.
 * @param ppgData The PPG waveform data.
 * @param ppgConf The confidence for each PPG data point.
 * @param fps The sampling frequency.
 * @returns An array of R-R intervals in milliseconds and the mean confidence.
 */
function getRrIntervals(
  ppgData: number[],
  ppgConf: number[],
  fps: number
): { intervals: number[]; confidence: number } {
  const standardizedPpg = standardize(ppgData);
  const peaks = findPeaks(standardizedPpg);

  if (peaks.length < 2) {
    return { intervals: [], confidence: 0 };
  }

  const intervalsMs = [];
  const confidences = [];
  for (let i = 1; i < peaks.length; i++) {
    const intervalInSamples = peaks[i] - peaks[i - 1];
    intervalsMs.push((intervalInSamples / fps) * 1000);
    const confSlice = ppgConf.slice(peaks[i - 1], peaks[i]);
    if (confSlice.length > 0) {
      confidences.push(confSlice.reduce((a, b) => a + b, 0) / confSlice.length);
    }
  }

  const meanConfidence =
    confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;

  return { intervals: intervalsMs, confidence: meanConfidence };
}

/**
 * Calculates the power of a signal within a specified frequency band using a Welch-like method.
 * @param waveform The input signal.
 * @param samplingFrequency The sampling rate of the signal.
 * @param minFrequency The lower bound of the frequency band.
 * @param maxFrequency The upper bound of the frequency band.
 * @returns The total power in the specified band.
 */
function getPowerInBand(
  waveform: number[],
  samplingFrequency: number,
  minFrequency: number,
  maxFrequency: number
): number | null {
  if (waveform.length < 1) return null;

  const nperseg = Math.min(waveform.length, 256);
  const nfft = Math.pow(
    2,
    Math.ceil(Math.log2(Math.max(nperseg, samplingFrequency / 0.01)))
  );
  const noverlap = Math.floor(nperseg / 2);
  const window = new Array(nperseg)
    .fill(1)
    .map((_, i) => 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nperseg - 1))));

  const segments = [];
  for (let i = 0; i <= waveform.length - nperseg; i += nperseg - noverlap) {
    segments.push(waveform.slice(i, i + nperseg));
  }

  if (segments.length === 0) return 0;

  let avgPsd = new Array(nfft / 2 + 1).fill(0);
  const windowSumSq = window.reduce((a, b) => a + b * b, 0);

  for (const segment of segments) {
    const mean = segment.reduce((a, b) => a + b, 0) / segment.length;
    const detrendedSegment = segment.map((v) => v - mean);
    const windowedSegment = detrendedSegment.map((v, i) => v * window[i]);

    const paddedSegment = [
      ...windowedSegment,
      ...new Array(nfft - nperseg).fill(0),
    ];

    const fft = new FFT(nfft);
    const complexArray = fft.createComplexArray();
    fft.toComplexArray(paddedSegment, complexArray);
    const transformed = fft.createComplexArray();
    fft.transform(transformed, complexArray);

    const psd = new Array(nfft / 2 + 1);
    for (let i = 0; i < nfft / 2 + 1; i++) {
      const real = transformed[2 * i];
      const imag = transformed[2 * i + 1];
      psd[i] = (real * real + imag * imag) / (samplingFrequency * windowSumSq);
    }
    avgPsd = avgPsd.map((v, i) => v + psd[i]);
  }

  avgPsd = avgPsd.map((v) => v / segments.length);
  const freqs = Array.from(
    { length: nfft / 2 + 1 },
    (_, i) => (i * samplingFrequency) / nfft
  );

  let totalPower = 0;
  for (let i = 1; i < freqs.length; i++) {
    if (freqs[i] >= minFrequency && freqs[i] <= maxFrequency) {
      totalPower +=
        ((avgPsd[i] + avgPsd[i - 1]) / 2) * (freqs[i] - freqs[i - 1]);
    }
  }
  return totalPower * 1e6; // to ms^2
}

/**
 * Estimates a rate (e.g., heart rate or respiratory rate in 1/min) from a waveform using FFT,
 * constrained by min and max frequencies.
 *
 * @param waveform - The input waveform as a number array.
 * @param samplingFrequency - The sampling rate of the waveform (Hz).
 * @param minFrequency - The minimum frequency of interest (Hz).
 * @param maxFrequency - The maximum frequency of interest (Hz).
 * @param desiredResolutionHz - (Optional) Desired frequency resolution in Hz.
 * @returns The estimated rate in cycles per minute, or null if no dominant frequency is found.
 */
export function estimateRateFromFFT(
  waveform: number[],
  samplingFrequency: number,
  minFrequency: number,
  maxFrequency: number,
  desiredResolutionHz?: number
): number | null {
  if (
    waveform.length === 0 ||
    samplingFrequency <= 0 ||
    minFrequency >= maxFrequency
  ) {
    throw new Error(
      'Invalid waveform data, sampling frequency, or frequency range.'
    );
  }

  // Calculate the required FFT size to achieve the desired resolution
  let fftSize: number = Math.pow(2, Math.ceil(Math.log2(waveform.length)));
  if (desiredResolutionHz) {
    const desiredFftSize = Math.ceil(samplingFrequency / desiredResolutionHz);
    fftSize = Math.max(
      fftSize,
      Math.pow(2, Math.ceil(Math.log2(desiredFftSize)))
    );
  }

  const paddedSignal: number[] = [
    ...waveform,
    ...Array(fftSize - waveform.length).fill(0),
  ];
  const fft = new FFT(fftSize);

  const complexArray: number[] = fft.createComplexArray();
  const outputArray: number[] = fft.createComplexArray();
  fft.toComplexArray(paddedSignal, complexArray);

  fft.realTransform(outputArray, paddedSignal);

  const magnitudes: number[] = [];
  for (let i = 0; i < fftSize / 2; i++) {
    const real = outputArray[2 * i];
    const imag = outputArray[2 * i + 1];
    magnitudes.push(Math.sqrt(real ** 2 + imag ** 2));
  }

  const nyquist: number = samplingFrequency / 2;
  const frequencies: number[] = Array.from(
    { length: magnitudes.length },
    (_, i) => (i / magnitudes.length) * nyquist
  );

  const filtered = frequencies
    .map((freq, index) => ({ freq, magnitude: magnitudes[index] }))
    .filter(({ freq }) => freq >= minFrequency && freq <= maxFrequency);

  if (filtered.length === 0) {
    return null;
  }

  const { freq: dominantFrequency } = filtered.reduce((max, current) =>
    current.magnitude > max.magnitude ? current : max
  );

  return dominantFrequency * 60;
}

/**
 * Estimates heart rate from the PPG waveform using FFT.
 * @param ppgWaveform - The PPG waveform tensor.
 * @param fs - The sampling rate of the waveform tensor (cycles per second)
 * @returns The estimated heart rate in beats per minute.
 */
export function estimateHeartRate(
  ppgWaveform: number[],
  fs: number
): number | null {
  return estimateRateFromFFT(
    ppgWaveform,
    fs,
    CALC_HR_MIN / 60,
    CALC_HR_MAX / 60
  );
}

/**
 * Estimates respiratory rate from the respiratory waveform using FFT.
 * @param respiratoryWaveform - The respiratory waveform tensor.
 * @param fs - The sampling rate of the waveform tensor (cycles per second)
 * @returns The estimated respiratory rate in breaths per minute.
 */
export function estimateRespiratoryRate(
  respiratoryWaveform: number[],
  fs: number
): number | null {
  return estimateRateFromFFT(
    respiratoryWaveform,
    fs,
    CALC_RR_MIN / 60,
    CALC_RR_MAX / 60
  );
}

export function estimateHrvSdnn(
  ppgData: number[],
  ppgConf: number[],
  fps: number
): VitalLensResult['vital_signs']['hrv_sdnn'] {
  const { intervals, confidence } = getRrIntervals(ppgData, ppgConf, fps);

  if (intervals.length < 2) {
    return {
      value: null,
      confidence: null,
      unit: 'ms',
      note: 'Could not detect enough heartbeats to calculate HRV (SDNN).',
    };
  }
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance =
    intervals.map((x) => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) /
    (intervals.length - 1);

  return {
    value: Math.sqrt(variance),
    confidence,
    unit: 'ms',
    note: 'Heart Rate Variability (Standard Deviation of NN intervals).',
  };
}

export function estimateHrvRmssd(
  ppgData: number[],
  ppgConf: number[],
  fps: number
): VitalLensResult['vital_signs']['hrv_rmssd'] {
  const { intervals, confidence } = getRrIntervals(ppgData, ppgConf, fps);

  if (intervals.length < 2) {
    return {
      value: null,
      confidence: null,
      unit: 'ms',
      note: 'Could not detect enough heartbeats to calculate HRV (RMSSD).',
    };
  }
  let sumOfSquaredDiffs = 0;
  for (let i = 1; i < intervals.length; i++) {
    sumOfSquaredDiffs += Math.pow(intervals[i] - intervals[i - 1], 2);
  }
  return {
    value: Math.sqrt(sumOfSquaredDiffs / (intervals.length - 1)),
    confidence,
    unit: 'ms',
    note: 'Heart Rate Variability (Root Mean Square of Successive Differences).',
  };
}

export function estimateHrvLfHf(
  ppgData: number[],
  ppgConf: number[],
  fps: number
): VitalLensResult['vital_signs']['hrv_lfhf'] {
  const { intervals } = getRrIntervals(ppgData, ppgConf, fps);

  if (intervals.length < 2) {
    return {
      value: null,
      confidence: null,
      unit: 'unitless',
      note: 'Could not detect enough heartbeats to calculate HRV (LF/HF).',
    };
  }

  const fs_r = 4.0;
  const t = intervals.reduce((acc, val) => {
    acc.push((acc.length > 0 ? acc[acc.length - 1] : 0) + val / 1000);
    return acc;
  }, [] as number[]);
  if (t.length === 0)
    return {
      value: null,
      confidence: null,
      unit: 'unitless',
      note: 'Could not determine timestamps for HRV.',
    };

  const t_u = [];
  for (let i = t[0]; i <= t[t.length - 1]; i += 1 / fs_r) {
    t_u.push(i);
  }

  const rr_u = t_u.map((t_val) => {
    let idx = t.findIndex((t_point) => t_point >= t_val);
    if (idx === -1) return intervals[intervals.length - 1];
    if (idx === 0) return intervals[0];
    const t0 = t[idx - 1],
      t1 = t[idx];
    const v0 = intervals[idx - 1],
      v1 = intervals[idx];
    return v0 + ((v1 - v0) * (t_val - t0)) / (t1 - t0);
  });

  const lfPower =
    getPowerInBand(rr_u, fs_r, HRV_LF_BAND[0], HRV_LF_BAND[1]) ?? 0;
  const hfPower =
    getPowerInBand(rr_u, fs_r, HRV_HF_BAND[0], HRV_HF_BAND[1]) ?? 0;

  if (hfPower === 0) {
    return {
      value: null,
      confidence: null,
      unit: 'unitless',
      note: 'High-frequency power is zero, LF/HF ratio cannot be calculated.',
    };
  }

  const overallConfidence = ppgConf.reduce((a, b) => a + b, 0) / ppgConf.length;

  return {
    value: lfPower / hfPower,
    confidence: overallConfidence,
    unit: 'unitless',
    note: 'Heart Rate Variability (Low-Frequency to High-Frequency power ratio).',
  };
}
