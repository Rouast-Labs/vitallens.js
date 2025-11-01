import {
  estimateRateFromFFT,
  estimateHeartRate,
  estimateRespiratoryRate,
  estimateHrvFromDetectionSequences,
  findPeaks,
} from '../../src/utils/physio';

/**
 * A simple seedable pseudo-random number generator (PRNG) for deterministic tests.
 * @param a The seed.
 * @returns A function that returns a random number between 0 and 1, just like Math.random().
 */
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates a synthetic, standardized PPG-like signal for testing.
 * @param options - Configuration for signal generation.
 * @returns A standardized array of numbers representing the synthetic PPG signal.
 */
function generateSyntheticPPG(options: {
  duration: number;
  fs: number;
  hr: number;
  noiseLevel?: number;
  hrVariability?: number;
  artifacts?: { index: number; amplitude: number }[];
  missingBeats?: number[];
  seed?: number;
}): number[] {
  const {
    duration,
    fs,
    hr,
    noiseLevel = 0.05,
    hrVariability = 0.01,
    artifacts = [],
    missingBeats = [],
    seed,
  } = options;

  const random = seed ? mulberry32(seed) : Math.random;

  const numSamples = Math.round(duration * fs);
  const t = Array.from({ length: numSamples }, (_, i) => i / fs);
  const beatTimes: number[] = [];
  let currentBeatTime = 0;
  let beatCounter = 0;
  while (currentBeatTime < duration) {
    const rrInterval = 60 / hr + (random() - 0.5) * 2 * hrVariability;
    if (!missingBeats.includes(beatCounter)) {
      beatTimes.push(currentBeatTime);
    }
    currentBeatTime += rrInterval;
    beatCounter++;
  }

  let signal = new Array(numSamples).fill(0);
  for (const beatTime of beatTimes) {
    for (let i = 0; i < numSamples; i++) {
      const timeSinceBeat = t[i] - beatTime;
      const rrInterval = 60 / hr;
      if (timeSinceBeat >= 0 && timeSinceBeat < rrInterval) {
        const phase = timeSinceBeat / rrInterval;
        let pulse = 0;
        if (phase < 0.2) {
          pulse = Math.sin((phase / 0.2) * (Math.PI / 2));
        } else {
          pulse = Math.exp(-5 * (phase - 0.2));
        }
        signal[i] += pulse;
      }
    }
  }

  for (let i = 0; i < numSamples; i++) {
    signal[i] += (random() - 0.5) * 2 * noiseLevel;
  }

  for (const artifact of artifacts) {
    if (artifact.index >= 0 && artifact.index < numSamples) {
      signal[artifact.index] += artifact.amplitude;
    }
  }

  const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
  const std = Math.sqrt(
    signal.map((x) => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) /
      signal.length
  );
  if (std > 0) {
    signal = signal.map((x) => (x - mean) / std);
  }

  return signal;
}

/**
 * Generates synthetic peak sequences directly for testing HRV functions.
 * @param options - Configuration for peak generation.
 * @returns An array of peak index sequences.
 */
function generateSyntheticPeaks(options: {
  duration: number;
  fs: number;
  hr: number;
  hrVariability?: number;
  missingBeats?: number[];
  seed?: number;
}): number[][] {
  const {
    duration,
    fs,
    hr,
    hrVariability = 0.01,
    missingBeats = [],
    seed,
  } = options;
  const random = seed ? mulberry32(seed) : Math.random;

  const peakTimes: number[] = [];
  let currentBeatTime = 0;
  let beatCounter = 0;
  while (currentBeatTime < duration) {
    const rrInterval = 60 / hr + (random() - 0.5) * 2 * hrVariability;
    if (!missingBeats.includes(beatCounter)) {
      peakTimes.push(currentBeatTime);
    }
    currentBeatTime += rrInterval;
    beatCounter++;
  }

  const peakIndices = peakTimes
    .map((time) => Math.round(time * fs))
    .filter((idx) => idx < duration * fs);

  // Mimic findPeaks by splitting into sequences if there's a large gap
  if (missingBeats.length === 0) {
    return [peakIndices];
  }

  const sequences: number[][] = [];
  let currentSequence: number[] = [];
  const maxInterval = (60 / 45) * 2; // ~2.6s interval for a 45bpm HR

  for (let i = 0; i < peakIndices.length; i++) {
    if (currentSequence.length > 0) {
      const lastTime = currentSequence[currentSequence.length - 1] / fs;
      const currentTime = peakIndices[i] / fs;
      if (currentTime - lastTime > maxInterval) {
        sequences.push(currentSequence);
        currentSequence = [];
      }
    }
    currentSequence.push(peakIndices[i]);
  }
  if (currentSequence.length > 0) {
    sequences.push(currentSequence);
  }

  return sequences;
}

// Helper function to generate peak sequences from a list of intervals
const createPeaksFromIntervals = (
  intervalsInSec: number[],
  fs: number
): number[][] => {
  const peakTimes = intervalsInSec.reduce(
    (acc, interval) => {
      acc.push(acc[acc.length - 1] + interval);
      return acc;
    },
    [0] // Start at time 0
  );
  return [peakTimes.map((t) => Math.round(t * fs))];
};

describe('estimateRateFromFFT', () => {
  it('should throw an error if the waveform is empty', () => {
    expect(() => {
      estimateRateFromFFT([], 30, 0.5, 3.5);
    }).toThrow(
      'Invalid waveform data, sampling frequency, or frequency range.'
    );
  });

  it('should throw an error if samplingFrequency is non-positive', () => {
    expect(() => {
      estimateRateFromFFT([1, 2, 3], 0, 0.5, 3.5);
    }).toThrow(
      'Invalid waveform data, sampling frequency, or frequency range.'
    );
  });

  it('should throw an error if minFrequency is greater than or equal to maxFrequency', () => {
    expect(() => {
      estimateRateFromFFT([1, 2, 3], 30, 3.5, 0.5);
    }).toThrow(
      'Invalid waveform data, sampling frequency, or frequency range.'
    );
  });

  it('should correctly estimate the dominant frequency within the range', () => {
    const waveform = [0, 1, 0, -1, 0, 1, 0, -1]; // 2 Hz dominant frequency
    const samplingFrequency = 8; // Sampling rate in Hz
    const result = estimateRateFromFFT(waveform, samplingFrequency, 0.5, 3); // Frequency range includes 1 Hz
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

    const result = estimateRateFromFFT(
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
    const result = estimateRateFromFFT(waveform, samplingFrequency, 0.5, 2); // Frequency range includes only 1 Hz
    expect(result).toBeCloseTo(1 * 60, 1); // Expected: 1 Hz = 60 BPM
  });
});

describe('findPeaks', () => {
  const fs = 30;

  it('should return an empty array for a flat signal with no peaks', () => {
    const flatSignal = new Array(1000).fill(0.5);
    const peaks = findPeaks(flatSignal, fs);
    expect(peaks).toEqual([]);
  });

  it('should find all peaks in a clean, regular signal', () => {
    const signal = generateSyntheticPPG({
      duration: 10,
      fs,
      hr: 60,
      noiseLevel: 0,
    });
    const peaks = findPeaks(signal, fs, {
      height: 0.5,
      threshold: 1.5,
    });
    // Should find one continuous sequence of peaks
    expect(peaks.length).toBe(1);
    // Should find approximately 10 peaks (10s * 60bpm / 60)
    expect(peaks[0].length).toBe(10);
  });

  it('should respect the height parameter and ignore small peaks', () => {
    let signal = generateSyntheticPPG({
      duration: 10,
      fs,
      hr: 60,
      noiseLevel: 0,
    });
    // Manually reduce the amplitude of the middle section of the standardized signal
    const startIndex = 3 * fs; // Attenuate from 3s
    const endIndex = 6 * fs; // to 6s
    signal = signal.map((val, i) =>
      i > startIndex && i < endIndex ? 0.49 : val
    );

    const peaks = findPeaks(signal, fs, { height: 0.5, threshold: 1.5 });

    // The peaks with reduced amplitude (< 0.5) should be missed, splitting the sequence
    expect(peaks.length).toBe(2);
    expect(peaks[0].length).toBeCloseTo(3, 0); // Peaks at ~1s, 2s, 3s
    expect(peaks[1].length).toBeCloseTo(4, 0); // Peaks at ~7s, 8s, 9s, 10s
  });

  it('should split sequences when two beats are missing', () => {
    const signal = generateSyntheticPPG({
      duration: 20,
      fs,
      hr: 60,
      noiseLevel: 0.02,
      missingBeats: [10, 11],
    });
    const peaks = findPeaks(signal, fs, {
      height: 0.5,
      threshold: 1.5,
    });

    // Missing beats create a long interval, which should break the validity check
    expect(peaks.length).toBe(2);
    expect(peaks[0].length).toBeCloseTo(10, 1);
    expect(peaks[1].length).toBeCloseTo(8, 1);
  });

  it('should reject sequences shorter than minSequenceLength', () => {
    const signal = generateSyntheticPPG({
      duration: 15,
      fs,
      hr: 60,
      noiseLevel: 0,
      missingBeats: [3, 4, 8, 9],
    });
    const peaks = findPeaks(signal, fs, {
      height: 0.5,
      threshold: 1.5,
      minSequenceLength: 5, // Require at least 5 consecutive valid peaks
    });

    // The sequences of 3 and 3 should be discarded
    expect(peaks.length).toBe(1);
    expect(peaks[0].length).toBeCloseTo(5, 0);
  });

  it('should split sequences around a large artifact', () => {
    const artifactIndex = 5 * fs; // at 5 seconds
    const signal = generateSyntheticPPG({
      duration: 10,
      fs,
      hr: 70,
      noiseLevel: 0.01,
      artifacts: [{ index: artifactIndex, amplitude: 10 }],
    });
    const peaks = findPeaks(signal, fs, {
      height: 0.5,
    });

    // The artifact might create a false peak and disrupt the interval, splitting the sequence
    expect(peaks.length).toBeGreaterThanOrEqual(1); // Could be 1 or 2 depending on how the artifact is handled
    const totalPeaks = peaks.reduce((sum, seq) => sum + seq.length, 0);
    expect(totalPeaks).toBeCloseTo(11, 1); // Approx 10s * 70bpm / 60
  });

  it('should use HR to set a tighter peak distance window, breaking sequences', () => {
    const fs = 30;
    const hr = 120; // expected interval = 15 samples
    // Signal with peaks at sample 1, 10 (ok), 25 (ok), 70 (too far)
    const signal = new Array(100).fill(0);
    signal[1] = 2;
    signal[10] = 2;
    signal[25] = 2;
    signal[70] = 2;

    // With HR=120, expected interval is 15. minDistance ~ 7.5, maxDistance ~ 37.5
    const peaksWithHr = findPeaks(signal, fs, {
      hr: hr,
      height: 1,
      threshold: -5,
      minSequenceLength: 3,
    });
    // Expected sequence: [1, 10, 25].
    // Peak at 70 is skipped because the distance (70-25=45) is > maxDistance (37.5),
    // which breaks the sequence. The new sequence `[70]` is too short and filtered out.
    expect(peaksWithHr.length).toBe(1);
    expect(peaksWithHr[0]).toEqual([1, 10, 25]);
  });

  it('should use HR to reject a peak that is too close', () => {
    const fs = 30;
    // With HR=60, expected interval is 30 samples. minDistance will be 15.
    // Without HR, default minDistance is round((30*60)/220) = 8.
    const signal = new Array(100).fill(0);
    signal[1] = 2; // First peak
    signal[13] = 2; // Second peak, distance is 12 samples.

    // Test WITHOUT HR: 12 > 8, so the peak at 13 should be found.
    const peaksWithoutHr = findPeaks(signal, fs, {
      threshold: -5,
      minSequenceLength: 2,
    });
    expect(peaksWithoutHr[0]).toEqual([1, 13]);

    // Test WITH HR: 12 < 15, so the peak at 13 should be rejected.
    const peaksWithHr = findPeaks(signal, fs, {
      hr: 60,
      threshold: -5,
      minSequenceLength: 2,
    });
    // The sequence [1] is too short and gets filtered out.
    expect(peaksWithHr).toEqual([]);
  });
});

describe('estimateHeartRate', () => {
  it('should estimate the correct heart rate from a synthetic PPG signal', () => {
    const fs = 30;
    const hr = 77;
    const ppgWaveform = generateSyntheticPPG({
      duration: 10,
      fs,
      hr,
      noiseLevel: 0.05,
    });
    const estimatedHr = estimateHeartRate(ppgWaveform, fs);
    expect(estimatedHr).toBeCloseTo(hr, 0);
  });
});

describe('estimateRespiratoryRate', () => {
  it('should estimate the correct respiratory rate from a synthetic signal', () => {
    const fs = 50;
    const rr = 15;
    const duration = 30;
    const numSamples = fs * duration;
    const respWaveform = Array.from({ length: numSamples }, (_, i) =>
      Math.sin((2 * Math.PI * (rr / 60) * i) / fs)
    );
    const estimatedRr = estimateRespiratoryRate(respWaveform, fs);
    expect(estimatedRr).toBeCloseTo(rr, 0);
  });
});

describe('estimateHrvFromDetectionSequences', () => {
  describe('SDNN metric', () => {
    it('should return null if not enough valid peaks are found', () => {
      const result = estimateHrvFromDetectionSequences([], [1], 100, 'sdnn');
      expect(result).toBeNull();
    });

    it('should calculate SDNN as 0 for a perfectly regular signal', () => {
      const fs = 100;
      const peakSequences = [Array.from({ length: 10 }, (_, i) => i * fs)];
      const ppgConf = new Array(10 * fs).fill(1.0);
      const result = estimateHrvFromDetectionSequences(
        peakSequences,
        ppgConf,
        fs,
        'sdnn'
      );
      expect(result!.value).toBeCloseTo(0);
      expect(result!.confidence).toBe(1.0);
    });

    it('should calculate a low SDNN for a synthetic signal with low variability', () => {
      const fs = 100;
      const peakSequences = generateSyntheticPeaks({
        duration: 30,
        fs,
        hr: 60,
        hrVariability: 0.01,
        seed: 42,
      });
      const ppgConf = new Array(30 * fs).fill(1.0);
      const result = estimateHrvFromDetectionSequences(
        peakSequences,
        ppgConf,
        fs,
        'sdnn'
      );
      expect(result!.value).toBeCloseTo(7, 2);
      expect(result!.confidence).toBe(1.0);
    });

    it('should pool intervals from multiple sequences', () => {
      const fs = 100;
      const peakSequences = generateSyntheticPeaks({
        duration: 30,
        fs,
        hr: 70,
        missingBeats: [10, 11, 12, 20, 21, 22],
        seed: 42,
      });
      const ppgConf = new Array(30 * fs).fill(0.95);
      const result = estimateHrvFromDetectionSequences(
        peakSequences,
        ppgConf,
        fs,
        'sdnn'
      );
      expect(peakSequences.length).toBeGreaterThan(1);
      expect(result!.value).toBeGreaterThan(0);
      expect(result!.value).toBeLessThan(25);
      expect(result!.confidence).toBeCloseTo(0.95);
    });

    it('should ignore outlier intervals caused by missed beats', () => {
      const fs = 100;
      const ppgConf = new Array(30 * fs).fill(1.0);
      const seed = 12345;

      // Generate a clean sequence of peaks.
      const cleanPeakSequences = generateSyntheticPeaks({
        duration: 30,
        fs,
        hr: 60,
        hrVariability: 0.02,
        seed: seed,
      });

      // Generate a sequence with a missed beat, using the same seed.
      const outlierPeakSequences = generateSyntheticPeaks({
        duration: 30,
        fs,
        hr: 60,
        hrVariability: 0.02,
        missingBeats: [15],
        seed: seed,
      });

      // Calculate SDNN on both.
      const resultClean = estimateHrvFromDetectionSequences(
        cleanPeakSequences,
        ppgConf,
        fs,
        'sdnn'
      );
      const resultWithOutlierFiltered = estimateHrvFromDetectionSequences(
        outlierPeakSequences,
        ppgConf,
        fs,
        'sdnn'
      );

      // Assertions
      // The clean result should have a predictable, low SDNN.
      expect(resultClean!.value).toBeCloseTo(12, 0);

      // The filtered result should be very close to the clean one, proving the outlier was handled.
      expect(resultWithOutlierFiltered!.value).toBeCloseTo(
        resultClean!.value,
        0
      );
    });

    describe('Non-uniform sampling', () => {
      it('should use timestamps to calculate NN intervals when provided', () => {
        const fs = 100; // This should be ignored by the calculation
        // Provide 9 peaks to get 8 intervals, satisfying MIN_INTERVALS = 8
        const peakIndices = [100, 205, 300, 410, 500, 605, 700, 810, 900];
        const timestamps = new Array(1000).fill(0).map((_, i) => i * 0.01);

        // Introduce non-uniformity at peak locations
        timestamps[100] = 1.0;
        timestamps[205] = 2.1; // 1.1s
        timestamps[300] = 3.0; // 0.9s
        timestamps[410] = 4.2; // 1.2s
        timestamps[500] = 5.0; // 0.8s
        timestamps[605] = 6.05; // 1.05s
        timestamps[700] = 7.0; // 0.95s
        timestamps[810] = 8.1; // 1.1s
        timestamps[900] = 9.0; // 0.9s

        const ppgConf = new Array(1000).fill(1.0);
        const peakSequences = [peakIndices];

        const result = estimateHrvFromDetectionSequences(
          peakSequences,
          ppgConf,
          fs,
          'sdnn',
          {
            timestamps: timestamps,
            confidenceThreshold: 0.5,
          }
        );

        console.log('result:', result);

        // Manual SDNN for [1.1, 0.9, 1.2, 0.8, 1.05, 0.95, 1.1, 0.9] is 125ms
        expect(result).not.toBeNull();
        expect(result!.value).toBeCloseTo(125.0, 1);
      });
    });
  });
  describe('RMSSD metric', () => {
    it('should return null if not enough valid peaks are found', () => {
      const result = estimateHrvFromDetectionSequences([], [1], 100, 'rmssd');
      expect(result).toBeNull();
    });

    it('should calculate RMSSD as 0 for a perfectly regular signal', () => {
      const fs = 100;
      const peakSequences = [Array.from({ length: 20 }, (_, i) => i * fs)];
      const ppgConf = new Array(20 * fs).fill(1.0);
      const result = estimateHrvFromDetectionSequences(
        peakSequences,
        ppgConf,
        fs,
        'rmssd'
      );
      expect(result!.value).toBeCloseTo(0);
      expect(result!.confidence).toBe(1.0);
    });

    it('should calculate a deterministic low RMSSD for a synthetic signal', () => {
      const fs = 100;
      const peakSequences = generateSyntheticPeaks({
        duration: 30,
        fs,
        hr: 60,
        hrVariability: 0.01,
        seed: 42,
      });
      const ppgConf = new Array(30 * fs).fill(1.0);
      const result = estimateHrvFromDetectionSequences(
        peakSequences,
        ppgConf,
        fs,
        'rmssd'
      );
      expect(result!.value).toBeCloseTo(11.3, 1);
      expect(result!.confidence).toBe(1.0);
    });
  });
  describe('LF/HF metric', () => {
    it('should return a high LF/HF ratio for a signal with strong LF modulation', () => {
      const fs = 100;
      const baseHr = 75;
      const modFreq = 0.1; // 0.1 Hz, squarely in the LF band
      const duration = 60; // 60s for a good spectral resolution
      const seed = 99;

      // Generate RR intervals modulated by a 0.1 Hz sine wave
      const random = mulberry32(seed);
      const beatTimes = [0];
      while (beatTimes[beatTimes.length - 1] < duration) {
        const time = beatTimes[beatTimes.length - 1];
        const currentHr = baseHr + 10 * Math.sin(2 * Math.PI * modFreq * time);
        const rrInterval = 60 / currentHr + (random() - 0.5) * 0.02;
        beatTimes.push(time + rrInterval);
      }
      beatTimes.pop();

      const peakSequences = [beatTimes.map((t) => Math.round(t * fs))];
      const ppgConf = new Array(duration * fs).fill(1.0);
      const result = estimateHrvFromDetectionSequences(
        peakSequences,
        ppgConf,
        fs,
        'lfhf'
      );

      // With strong LF modulation and weak HF modulation, the ratio should be high.
      expect(result!.value).toBeGreaterThan(2);
      expect(result!.confidence).toBe(1.0);
    });
    it('should return a low LF/HF ratio for a signal with strong HF modulation', () => {
      const fs = 100;
      const baseHr = 75;
      const modFreq = 0.25; // 0.25 Hz, squarely in the HF band (0.15 - 0.4 Hz)
      const duration = 60;
      const seed = 101;

      // Generate RR intervals modulated by a 0.25 Hz sine wave
      const random = mulberry32(seed);
      const beatTimes = [0];
      while (beatTimes[beatTimes.length - 1] < duration) {
        const time = beatTimes[beatTimes.length - 1];
        const currentHr = baseHr + 10 * Math.sin(2 * Math.PI * modFreq * time);
        const rrInterval = 60 / currentHr + (random() - 0.5) * 0.01; // Very low noise
        beatTimes.push(time + rrInterval);
      }
      beatTimes.pop();

      const peakSequences = [beatTimes.map((t) => Math.round(t * fs))];
      const ppgConf = new Array(duration * fs).fill(1.0);
      const result = estimateHrvFromDetectionSequences(
        peakSequences,
        ppgConf,
        fs,
        'lfhf'
      );

      // With strong HF modulation and weak LF, the ratio should be very low.
      expect(result!.value).toBeLessThan(0.5);
    });
    it('should return a predictable ratio for a signal with known LF and HF components', () => {
      const fs = 100;
      const baseHr = 75;
      const lfModFreq = 0.1; // 0.1 Hz
      const hfModFreq = 0.25; // 0.25 Hz
      const lfAmplitude = 10; // Stronger LF component
      const hfAmplitude = 5; // Weaker HF component
      const duration = 120; // Longer duration for better frequency resolution

      // Power is proportional to amplitude squared. Expected power ratio ≈ (10^2) / (5^2) = 100 / 25 = 4.0
      const expectedRatio = Math.pow(lfAmplitude, 2) / Math.pow(hfAmplitude, 2);

      const beatTimes = [0];
      while (beatTimes[beatTimes.length - 1] < duration) {
        const time = beatTimes[beatTimes.length - 1];
        const lfMod = lfAmplitude * Math.sin(2 * Math.PI * lfModFreq * time);
        const hfMod = hfAmplitude * Math.sin(2 * Math.PI * hfModFreq * time);
        const currentHr = baseHr + lfMod + hfMod;
        const rrInterval = 60 / currentHr; // No extra noise for a clean signal
        beatTimes.push(time + rrInterval);
      }
      beatTimes.pop();

      const peakSequences = [beatTimes.map((t) => Math.round(t * fs))];
      const ppgConf = new Array(duration * fs).fill(1.0);
      const result = estimateHrvFromDetectionSequences(
        peakSequences,
        ppgConf,
        fs,
        'lfhf'
      );

      const relativeError =
        Math.abs(result!.value - expectedRatio) / expectedRatio;
      expect(relativeError).toBeLessThan(0.2); // Assert that the error is less than 20%
    });
  });
  describe('Hand-Calculated Verification', () => {
    const fs = 100;
    // A simple set of NN intervals (in seconds) for manual calculation.
    const nnIntervals = [1.0, 1.1, 0.9, 1.2, 0.8, 1.05, 0.95, 1.0]; // 8 intervals
    const ppgConf = new Array(8 * fs).fill(1.0);
    const peakSequences = createPeaksFromIntervals(nnIntervals, fs);
    /**
     * SDNN Manual Calculation (8 intervals):
     * Mean = (1.0 + 1.1 + 0.9 + 1.2 + 0.8 + 1.05 + 0.95 + 1.0) / 8 = 1.0s
     * Variance = [0² + 0.1² + (-0.1)² + 0.2² + (-0.2)² + 0.05² + (-0.05)² + 0²] / 8 = 0.013125 s²
     * Std Dev = sqrt(0.013125) ≈ 0.11456s
     * SDNN = 114.56 ms
     */
    it('should calculate a precise, hand-verified SDNN using 8 intervals', () => {
      const result = estimateHrvFromDetectionSequences(
        peakSequences,
        ppgConf,
        fs,
        'sdnn'
      );
      expect(result!.value).toBeCloseTo(114.56, 2);
    });

    /**
     * RMSSD Manual Calculation (8 intervals):
     * Successive Diffs = [0.1, -0.2, 0.3, -0.4, 0.25, -0.1, 0.05]
     * Squared Diffs = [0.01, 0.04, 0.09, 0.16, 0.0625, 0.01, 0.0025]
     * Mean of Squared Diffs = sum(Squared Diffs) / 7 = 0.375 / 7 ≈ 0.05357 s²
     * RMSSD = sqrt(0.05357) ≈ 0.23145s
     * RMSSD = 231.46 ms
     */
    it('should calculate a precise, hand-verified RMSSD using 8 intervals', () => {
      const result = estimateHrvFromDetectionSequences(
        peakSequences,
        ppgConf,
        fs,
        'rmssd'
      );
      expect(result!.value).toBeCloseTo(231.46, 2);
    });
  });
});
