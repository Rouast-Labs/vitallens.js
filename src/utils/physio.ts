import FFT from 'fft.js';
import {
  CALC_HR_MAX,
  CALC_HR_MIN,
  CALC_RR_MAX,
  CALC_RR_MIN,
  HRV_HF_BAND,
  HRV_LF_BAND,
} from '../config/constants';
import { VitalLensResult } from '../types';

/**
 * Defines the types of HRV metrics that can be calculated.
 */
export type HRVMetric = 'sdnn' | 'rmssd' | 'lfhf';

/**
 * Helper function to calculate the mean of an array of numbers.
 * @param arr - The input array.
 * @returns The mean of the array.
 */
const mean = (arr: number[]): number => {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
};

/**
 * Helper function to calculate the standard deviation of an array of numbers.
 * @param arr - The input array.
 * @returns The standard deviation of the array.
 */
const stdDev = (arr: number[]): number => {
  if (arr.length < 2) return 0;
  const arrMean = mean(arr);
  const variance =
    arr.map((x) => Math.pow(x - arrMean, 2)).reduce((a, b) => a + b, 0) /
    arr.length;
  return Math.sqrt(variance);
};

/**
 * Filters NN intervals to remove outliers. This robust method filters intervals
 * that deviate from the median by more than a given percentage.
 * @param nnIntervals - Array of NN intervals in seconds.
 * @param threshold - The relative difference threshold (e.g., 0.2 for 20%).
 * @returns A filtered array of NN intervals.
 */
const _filterNNIntervals = (
  nnIntervals: number[],
  threshold = 0.3
): number[] => {
  if (nnIntervals.length < 3) {
    return nnIntervals;
  }
  // Sort a copy to find the median, which is robust to outliers
  const sortedIntervals = [...nnIntervals].sort((a, b) => a - b);
  let median;
  const mid = Math.floor(sortedIntervals.length / 2);
  if (sortedIntervals.length % 2 === 0) {
    // Average the two middle elements for even-sized arrays
    median = (sortedIntervals[mid - 1] + sortedIntervals[mid]) / 2;
  } else {
    // The middle element for odd-sized arrays
    median = sortedIntervals[mid];
  }

  // Define the absolute bounds for acceptable intervals
  const lowerBound = median * (1 - threshold);
  const upperBound = median * (1 + threshold);

  // Filter the original array to keep intervals within the bounds
  return nnIntervals.filter(
    (interval) => interval >= lowerBound && interval <= upperBound
  );
};

/**
 * Performs linear interpolation.
 * @param x - The x-coordinates of the data points.
 * @param y - The y-coordinates of the data points.
 * @param x_new - The x-coordinates at which to evaluate the interpolated values.
 * @returns The interpolated y-values.
 */
const _linearInterp = (x: number[], y: number[], x_new: number[]): number[] => {
  const y_new: number[] = new Array(x_new.length);
  let currentIndex = 0;

  for (let i = 0; i < x_new.length; i++) {
    const x_val = x_new[i];

    if (x_val < x[0]) {
      y_new[i] = y[0];
      continue;
    }
    if (x_val > x[x.length - 1]) {
      y_new[i] = y[y.length - 1];
      continue;
    }

    // Advance the pointer efficiently instead of restarting the search
    while (currentIndex < x.length - 2 && x[currentIndex + 1] < x_val) {
      currentIndex++;
    }

    const x0 = x[currentIndex],
      y0 = y[currentIndex];
    const x1 = x[currentIndex + 1],
      y1 = y[currentIndex + 1];

    y_new[i] = y0 + ((y1 - y0) * (x_val - x0)) / (x1 - x0);
  }
  return y_new;
};

/**
 * Calculates Power Spectral Density using Welch's method.
 * @param signal - The input signal.
 * @param fs - The sampling frequency.
 * @param nperseg - Length of each segment.
 * @returns An object containing frequencies and power spectral density.
 */
const _calculateWelchPSD = (
  signal: number[],
  fs: number,
  nperseg: number
): { freqs: number[]; psd: number[] } => {
  const noverlap = Math.floor(nperseg / 2);
  const step = nperseg - noverlap;
  const numSegments = Math.floor((signal.length - noverlap) / step);

  if (numSegments < 1) return { freqs: [], psd: [] };

  const nfft = Math.pow(2, Math.ceil(Math.log2(nperseg)));
  const fft = new FFT(nfft);
  const hanningWindow = Array.from(
    { length: nperseg },
    (_, i) => 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nperseg - 1)))
  );
  const S2 = hanningWindow.reduce((sum, val) => sum + val * val, 0);

  const psdSum = new Array(Math.floor(nfft / 2) + 1).fill(0);

  for (let i = 0; i < numSegments; i++) {
    const start = i * step;
    const segment = signal.slice(start, start + nperseg);
    if (segment.length !== nperseg) continue;

    const segmentMean = mean(segment);
    const windowedSegment = segment.map(
      (val, idx) => (val - segmentMean) * hanningWindow[idx]
    );
    const paddedSegment = [
      ...windowedSegment,
      ...new Array(nfft - nperseg).fill(0),
    ];

    const out = fft.createComplexArray();
    const complexSegment = fft.createComplexArray();
    fft.toComplexArray(paddedSegment, complexSegment);
    fft.realTransform(out, complexSegment);

    for (let j = 0; j <= nfft / 2; j++) {
      const real = out[2 * j];
      const imag = out[2 * j + 1];
      const magSq = real * real + imag * imag;
      const scale = j === 0 || j === nfft / 2 ? 1 : 2;
      psdSum[j] += scale * magSq;
    }
  }

  const scaleFactor = 1.0 / (S2 * fs * numSegments);
  const psd = psdSum.map((val) => val * scaleFactor);
  const freqs = Array.from({ length: psd.length }, (_, i) => (i * fs) / nfft);

  return { freqs, psd };
};

/**
 * Performs trapezoidal integration.
 * @param y - The y-values (integrand).
 * @param x - The x-values (spacing).
 * @returns The integrated value.
 */
const _trapz = (y: number[], x: number[]): number => {
  let integral = 0;
  for (let i = 0; i < y.length - 1; i++) {
    integral += ((y[i] + y[i + 1]) / 2) * (x[i + 1] - x[i]);
  }
  return integral;
};

/**
 * A factory function that returns the specific mathematical operation for a given HRV metric.
 * @param metric The HRV metric to calculate.
 * @returns A function that takes an array of NN intervals (in seconds) and returns the HRV value.
 */
const _getHrvFunction = (
  metric: HRVMetric
): ((nnIntervals: number[]) => number) => {
  switch (metric) {
    case 'sdnn':
      return (nnIntervals: number[]) => {
        // Return SDNN in milliseconds
        return stdDev(nnIntervals) * 1000;
      };
    case 'rmssd':
      return (nnIntervals: number[]) => {
        if (nnIntervals.length < 2) return 0;
        let sumOfSquares = 0;
        for (let i = 0; i < nnIntervals.length - 1; i++) {
          const diff = nnIntervals[i + 1] - nnIntervals[i];
          sumOfSquares += diff * diff;
        }
        // Return RMSSD in milliseconds
        return Math.sqrt(sumOfSquares / (nnIntervals.length - 1)) * 1000;
      };
    case 'lfhf':
      return (nnIntervals: number[]) => {
        const fs_r = 4.0;
        const t = nnIntervals.reduce(
          (acc, val, i) => {
            acc.push((acc[i - 1] || 0) + val);
            return acc;
          },
          [0] as number[]
        );
        t.shift(); // Remove the initial 0
        if (t.length === 0 || t[t.length - 1] <= 0) return 0;

        const t_u = [];
        for (let time = t[0]; time <= t[t.length - 1]; time += 1 / fs_r) {
          t_u.push(time);
        }
        const nn_u = _linearInterp(t, nnIntervals, t_u);

        const nperseg = Math.min(nn_u.length, 256);
        const { freqs, psd } = _calculateWelchPSD(nn_u, fs_r, nperseg);

        const lf_indices = freqs.reduce((acc, freq, i) => {
          if (freq >= HRV_LF_BAND[0] && freq < HRV_LF_BAND[1]) acc.push(i);
          return acc;
        }, [] as number[]);

        const hf_indices = freqs.reduce((acc, freq, i) => {
          if (freq >= HRV_HF_BAND[0] && freq <= HRV_HF_BAND[1]) acc.push(i);
          return acc;
        }, [] as number[]);

        if (lf_indices.length < 2 || hf_indices.length < 2) return 0;

        const lf_power = _trapz(
          lf_indices.map((i) => psd[i]),
          lf_indices.map((i) => freqs[i])
        );
        const hf_power = _trapz(
          hf_indices.map((i) => psd[i]),
          hf_indices.map((i) => freqs[i])
        );

        return hf_power > 0 ? lf_power / hf_power : 0;
      };
    default: // This ensures that if new metrics are added to the type, this function will error until updated.
      throw new Error(`Unhandled HRV metric: ${metric}`);
  }
};

/**
 * Detects peaks in a physiological signal, grouping them into continuous sequences.
 * This function uses a single-pass adaptive threshold (Z-Score) method.
 *
 * @param signal - The input signal array.
 * @param fs - The sampling frequency in Hz.
 * @param options - Configuration options for peak detection.
 * - `lag`: The number of past samples to use for calculating rolling stats. (Default: fs * 1.5)
 * - `height`: The minimum absolute amplitude for a point to be considered a peak. (Default: 0)
 * - `threshold`: The Z-score threshold. A point is a peak if it's this many std devs above the mean. (Default: 2.5)
 * - `minDistanceSamples`: Minimum samples between consecutive peaks. (Default: based on 220 BPM)
 * - `maxDistanceSamples`: Maximum samples between consecutive peaks to remain in the same sequence. (Default: based on 45 BPM)
 * - `minSequenceLength`: The minimum number of peaks required to form a valid sequence. (Default: 3)
 * - `hr`: An estimated heart rate (bpm) to create a more adaptive window for peak distances.
 * @returns An array of arrays, where each inner array is a sequence of peak indices.
 */
export function findPeaks(
  signal: number[],
  fs: number,
  options: {
    lag?: number;
    height?: number;
    threshold?: number;
    minDistanceSamples?: number;
    maxDistanceSamples?: number;
    minSequenceLength?: number;
    hr?: number;
  } = {}
): number[][] {
  // Set parameters
  const lag = options.lag ?? Math.round(fs * 1.5);
  const height = options.height ?? 0;
  const threshold = options.threshold ?? 1.5;
  let minDistanceSamples: number;
  let maxDistanceSamples: number;
  if (options.hr && options.hr >= 45 && options.hr <= 220) {
    // If HR is provided, create an adaptive window for peak distance.
    const expectedIntervalSamples = (fs * 60) / options.hr;
    minDistanceSamples =
      options.minDistanceSamples ?? Math.round(expectedIntervalSamples * 0.5);
    // Allow for a pause of ~2.5 beats to avoid breaking sequences too easily
    maxDistanceSamples =
      options.maxDistanceSamples ?? Math.round(expectedIntervalSamples * 2.5);
  } else {
    // Fallback to fixed physiological limits if HR is not available.
    minDistanceSamples =
      options.minDistanceSamples ?? Math.round((fs * 60) / 220); // Max physiological HR
    maxDistanceSamples =
      options.maxDistanceSamples ?? Math.round(((fs * 60) / 45) * 2); // Detects a pause > 2 beats at 45bpm
  }
  const minSequenceLength = options.minSequenceLength ?? 3;

  if (signal.length <= lag) {
    return [];
  }

  // Pre-pad the signal to handle edge effects
  const padding = new Array(lag).fill(signal[0]);
  const paddedSignal = [...padding, ...signal];

  const sequences: number[][] = [];
  let currentSequence: number[] = [];
  let lastPeakOverall = -Infinity;

  // Single-pass iteration through the padded signal
  for (let i = lag; i < paddedSignal.length - 1; i++) {
    const currentValue = paddedSignal[i];
    const originalIndex = i - lag;

    // Check for local maximum first (cheap check)
    if (
      currentValue > paddedSignal[i - 1] &&
      currentValue > paddedSignal[i + 1] &&
      currentValue > height
    ) {
      // Calculate stats only when necessary
      const window = paddedSignal.slice(i - lag, i);
      const windowMean = mean(window);
      const windowStd = stdDev(window);
      const dynamicThreshold = windowMean + threshold * windowStd;

      if (currentValue > dynamicThreshold) {
        if (originalIndex - lastPeakOverall >= minDistanceSamples) {
          const lastPeakInSequence =
            currentSequence.length > 0
              ? currentSequence[currentSequence.length - 1]
              : -Infinity;

          if (originalIndex - lastPeakInSequence < maxDistanceSamples) {
            // The sequence continues.
            currentSequence.push(originalIndex);
          } else {
            // The sequence is broken. Finalize the old one and start a new one.
            if (currentSequence.length > 0) {
              sequences.push(currentSequence);
            }
            currentSequence = [originalIndex];
          }
          lastPeakOverall = originalIndex;
        }
      }
    }
  }

  // Finalize and Filter
  if (currentSequence.length > 0) {
    sequences.push(currentSequence);
  }

  return sequences.filter((seq) => seq.length >= minSequenceLength);
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

/**
 * Estimates a specific HRV metric from a series of detected peak sequences.
 * @param sequences - An array of peak index sequences from `findPeaks`.
 * @param ppgConfidence - Confidence scores for the original PPG waveform.
 * @param fs - The sampling frequency in Hz.
 * @param metric - The HRV metric to calculate ('sdnn' or 'rmssd').
 * @param timestamps - Timestamps of the original signal (optional)
 * @returns A result object for the specified HRV metric, or null if calculation is not possible.
 */
export function estimateHrvFromDetectionSequences(
  sequences: number[][],
  ppgConfidence: number[],
  fs: number,
  metric: HRVMetric,
  timestamps?: number[]
):
  | (Omit<Required<VitalLensResult['vital_signs']>['hrv_sdnn'], 'value'> & {
      value: number;
    })
  | null {
  const MIN_INTERVALS = 8; // Minimum number of NN intervals required for a reliable calculation.

  if (sequences.length === 0) {
    return null;
  }

  // Create objects containing the interval and the indices of the peaks that form it.
  const intervalData = sequences.flatMap((sequence) => {
    const data: { interval: number; idx1: number; idx2: number }[] = [];
    for (let i = 0; i < sequence.length - 1; i++) {
      const idx1 = sequence[i];
      const idx2 = sequence[i + 1];
      let intervalInSeconds: number;
      if (timestamps && idx1 < timestamps.length && idx2 < timestamps.length) {
        intervalInSeconds = timestamps[idx2] - timestamps[idx1];
      } else {
        intervalInSeconds = (idx2 - idx1) / fs;
      }
      data.push({ interval: intervalInSeconds, idx1, idx2 });
    }
    return data;
  });

  // Filter out outlier intervals.
  const allIntervalValues = intervalData.map((d) => d.interval);
  const filteredIntervalValues = _filterNNIntervals(allIntervalValues, 0.3);

  if (filteredIntervalValues.length < MIN_INTERVALS) {
    return null;
  }

  // Find the indices of peaks that form the valid, filtered intervals.
  const validPeakIndices = new Set<number>();
  const validIntervalData = intervalData.filter((d) =>
    filteredIntervalValues.includes(d.interval)
  );
  validIntervalData.forEach((d) => {
    validPeakIndices.add(d.idx1);
    validPeakIndices.add(d.idx2);
  });

  // Calculate the minimum confidence among only the used peaks.
  let minConfidence = 1.0;
  validPeakIndices.forEach((idx) => {
    const peakConf = ppgConfidence[idx] ?? 0;
    if (peakConf < minConfidence) {
      minConfidence = peakConf;
    }
  });

  // Get the specific HRV calculation function
  const hrvFunction = _getHrvFunction(metric);
  const hrvValue = hrvFunction(filteredIntervalValues);

  return {
    value: hrvValue,
    unit: 'ms',
    confidence: minConfidence,
    note: `Estimate of the heart rate variability (${metric.toUpperCase()}).`,
  };
}
