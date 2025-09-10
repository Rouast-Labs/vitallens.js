import { estimateRateFromFFT } from '../../src/utils/physio';

// TODO: Complete tests

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
