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
 * - `maxDistanceSamples`: Maximum samples between consecutive peaks to remain in the same sequence. (Default: based on 40 BPM)
 * - `minSequenceLength`: The minimum number of peaks required to form a valid sequence. (Default: 3)
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
  } = {}
): number[][] {
  // Set parameters
  const lag = options.lag ?? Math.round(fs * 1.5);
  const height = options.height ?? 0;
  const threshold = options.threshold ?? 1.5;
  const minDistanceSamples =
    options.minDistanceSamples ?? Math.round((fs * 60) / 220); // Max physiological HR
  const maxDistanceSamples =
    options.maxDistanceSamples ?? Math.round(((fs * 60) / 45) * 2); // Detects a pause > 2 beats at 45bpm
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
 * Estimates HRV (SDNN) from the PPG waveform.
 * @param ppgWaveform - The PPG waveform data.
 * @param ppgConfidence - The confidence scores for the PPG waveform.
 * @param fs - The sampling frequency in Hz.
 * @returns An object containing the SDNN value, unit, confidence, and note.
 */
export function estimateHrvSdnn(
  ppgWaveform: number[],
  ppgConfidence: number[],
  fs: number
): VitalLensResult['vital_signs']['hrv_sdnn'] {
  // TODO: Implement this function.
  // 1. Detect peaks from ppgWaveform (e.g., using a `detectPeaks` helper).
  // 2. Filter peaks based on ppgConfidence.
  // 3. Calculate NN intervals (time difference between consecutive peaks).
  // 4. Calculate the standard deviation of NN intervals.
  // 5. Convert to milliseconds.
  // 6. Return the result object.
  return {
    value: 50.0, // Placeholder
    unit: 'ms',
    confidence: 0.95, // Placeholder
    note: 'Estimate of the heart rate variability (SDNN).',
  };
}

/**
 * Estimates HRV (RMSSD) from the PPG waveform.
 * @param ppgWaveform - The PPG waveform data.
 * @param ppgConfidence - The confidence scores for the PPG waveform.
 * @param fs - The sampling frequency in Hz.
 * @returns An object containing the RMSSD value, unit, confidence, and note.
 */
export function estimateHrvRmssd(
  ppgWaveform: number[],
  ppgConfidence: number[],
  fs: number
): VitalLensResult['vital_signs']['hrv_rmssd'] {
  // TODO: Implement this function.
  // 1. Detect peaks and get NN intervals as in SDNN.
  // 2. Calculate successive differences of NN intervals.
  // 3. Calculate the square root of the mean of the squares of these differences.
  // 4. Convert to milliseconds.
  // 5. Return the result object.
  return {
    value: 30.0, // Placeholder
    unit: 'ms',
    confidence: 0.95, // Placeholder
    note: 'Estimate of the heart rate variability (RMSSD).',
  };
}

/**
 * Estimates HRV (LF/HF ratio) from the PPG waveform.
 * @param ppgWaveform - The PPG waveform data.
 * @param ppgConfidence - The confidence scores for the PPG waveform.
 * @param fs - The sampling frequency in Hz.
 * @returns An object containing the LF/HF ratio value, unit, confidence, and note.
 */
export function estimateHrvLfHf(
  ppgWaveform: number[],
  ppgConfidence: number[],
  fs: number
): VitalLensResult['vital_signs']['hrv_lfhf'] {
  // TODO: Implement this function. This is the most complex one.
  // 1. Detect peaks and get NN intervals (NNi) and their timestamps (t_NNi).
  // 2. The (t_NNi, NNi) series is unevenly sampled. Resample it to an evenly spaced time series (e.g., at 4 Hz).
  //    - Linear or cubic spline interpolation is common.
  // 3. Apply a window function (e.g., Hanning) to segments of the resampled signal.
  // 4. Compute the Power Spectral Density (PSD) of the windowed signal, often using FFT (Welch's method).
  // 5. Integrate the PSD over the Low-Frequency (LF) band (0.04-0.15 Hz) and High-Frequency (HF) band (0.15-0.4 Hz).
  // 6. Calculate the ratio LF/HF.
  // 7. Return the result object.
  return {
    value: 2.0, // Placeholder
    unit: 'unitless',
    confidence: 0.9, // Placeholder
    note: 'Estimate of the heart rate variability (LF/HF ratio).',
  };
}
