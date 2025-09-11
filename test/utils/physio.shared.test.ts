import {
  estimateRateFromFFT,
  estimateHeartRate,
  estimateRespiratoryRate,
  estimateHrvSdnn,
  estimateHrvRmssd,
  estimateHrvLfHf,
  findPeaks,
} from '../../src/utils/physio';

describe('estimateRateFromFFT', () => {
  it('should throw an error if the waveform is empty', () => {
    expect(() => {
      estimateRateFromFFT([], 30, 0.5, 3.5);
    }).toThrowError(
      'Invalid waveform data, sampling frequency, or frequency range.'
    );
  });

  it('should throw an error if samplingFrequency is non-positive', () => {
    expect(() => {
      estimateRateFromFFT([1, 2, 3], 0, 0.5, 3.5);
    }).toThrowError(
      'Invalid waveform data, sampling frequency, or frequency range.'
    );
  });

  it('should throw an error if minFrequency is greater than or equal to maxFrequency', () => {
    expect(() => {
      estimateRateFromFFT([1, 2, 3], 30, 3.5, 0.5);
    }).toThrowError(
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

/**
 * Generates a synthetic, standardized PPG-like signal for testing.
 * @param options - Configuration for signal generation.
 * - `duration`: The duration of the signal in seconds.
 * - `fs`: The sampling frequency in Hz.
 * - `hr`: The heart rate in beats per minute.
 * - `noiseLevel`: The standard deviation of additive Gaussian noise before standardization.
 * - `hrVariability`: Randomness factor for beat-to-beat intervals.
 * - `artifacts`: Array of objects to add sharp artifacts to the signal.
 * - `missingBeats`: Array of beat indices to skip, simulating missed beats.
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
}): number[] {
  const {
    duration,
    fs,
    hr,
    noiseLevel = 0.05,
    hrVariability = 0.01,
    artifacts = [],
    missingBeats = [],
  } = options;

  const numSamples = Math.round(duration * fs);
  const t = Array.from({ length: numSamples }, (_, i) => i / fs);
  const beatTimes: number[] = [];
  let currentBeatTime = 0;
  let beatCounter = 0;
  while (currentBeatTime < duration) {
    const rrInterval = 60 / hr + (Math.random() - 0.5) * 2 * hrVariability;
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
    signal[i] += (Math.random() - 0.5) * 2 * noiseLevel;
  }

  for (const artifact of artifacts) {
    if (artifact.index >= 0 && artifact.index < numSamples) {
      signal[artifact.index] += artifact.amplitude;
    }
  }

  // Standardize the final signal to have mean ~0 and std ~1
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

    console.log(peaks);

    // The artifact might create a false peak and disrupt the interval, splitting the sequence
    expect(peaks.length).toBeGreaterThanOrEqual(1); // Could be 1 or 2 depending on how the artifact is handled
    const totalPeaks = peaks.reduce((sum, seq) => sum + seq.length, 0);
    expect(totalPeaks).toBeCloseTo(11, 1); // Approx 10s * 70bpm / 60
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

// describe('estimateHrvSdnn', () => {
//   it('should calculate SDNN correctly for a synthetic signal with stable HR', () => {
//     const fs = 100;
//     const hr = 60; // 60 BPM -> 1s R-R interval
//     const ppgSignal = generateSyntheticPPG(30, fs, hr, 0.01);
//     const ppgConf = new Array(ppgSignal.length).fill(1.0);

//     const result = estimateHrvSdnn(ppgSignal, ppgConf, fs);

//     // For a perfectly stable HR, SDNN should be very close to 0.
//     // We allow a small tolerance for noise and peak detection imperfections.
//     expect(result!.value).toBeLessThan(10); // Expect SDNN < 10 ms for a stable signal
//     expect(result!.confidence).toBeGreaterThan(0.9);
//     expect(result!.unit).toBe('ms');
//   });
// });

// describe('estimateHrvRmssd', () => {
//   it('should calculate RMSSD correctly for a synthetic signal with stable HR', () => {
//     const fs = 100;
//     const hr = 60;
//     const ppgSignal = generateSyntheticPPG(30, fs, hr, 0.01);
//     const ppgConf = new Array(ppgSignal.length).fill(1.0);

//     const result = estimateHrvRmssd(ppgSignal, ppgConf, fs);

//     // For a perfectly stable HR, RMSSD should be very close to 0.
//     expect(result!.value).toBeLessThan(10); // Expect RMSSD < 10 ms for a stable signal
//     expect(result!.confidence).toBeGreaterThan(0.9);
//     expect(result!.unit).toBe('ms');
//   });
// });

// describe('estimateHrvLfHf', () => {
//   it('should calculate LF/HF ratio', () => {
//     const fs = 100;
//     // We create a signal with a low frequency modulation of the heart rate
//     const baseHr = 70;
//     const modFreq = 0.1; // 0.1 Hz, squarely in the LF band
//     const duration = 60;
//     const numSamples = duration * fs;
//     const t = Array.from({ length: numSamples }, (_, i) => i / fs);
//     const instantaneousHr = t.map(
//       (time) => baseHr + 10 * Math.sin(2 * Math.PI * modFreq * time)
//     );

//     // This is a simplified way to generate peaks; a full PPG is complex
//     const ppgSignal = new Array(numSamples).fill(0);
//     let lastPeakTime = 0;
//     for (let i = 0; i < numSamples; i++) {
//       if (t[i] - lastPeakTime >= 60 / instantaneousHr[i]) {
//         ppgSignal[i] = 1.0; // Mark a peak
//         lastPeakTime = t[i];
//       }
//     }
//     const ppgConf = new Array(ppgSignal.length).fill(1.0);

//     const result = estimateHrvLfHf(ppgSignal, ppgConf, fs);

//     // With strong 0.1Hz modulation, LF power should dominate HF power.
//     expect(result!.value).toBeGreaterThan(1.5);
//     expect(result!.confidence).toBeGreaterThan(0.8);
//     expect(result!.unit).toBe('unitless');
//   });
// });
