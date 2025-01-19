import { MethodConfig } from "../config/methodsConfig";
import { VitalLensOptions, VitalLensResult } from "../types/core";
import { IVitalsEstimateManager } from '../types/IVitalsEstimateManager';
import { 
  AGG_WINDOW_SIZE, CALC_HR_MAX, CALC_HR_MIN, CALC_HR_MIN_WINDOW_SIZE, CALC_HR_WINDOW_SIZE, 
  CALC_RR_MAX, CALC_RR_MIN, CALC_RR_MIN_WINDOW_SIZE, CALC_RR_WINDOW_SIZE 
} from '../config/constants';
import FFT from "fft.js";

export class VitalsEstimateManager implements IVitalsEstimateManager {
  private waveformBuffers: Map<string, { ppg: { sum: number[]; count: number[] }, resp: { sum: number[]; count: number[] } }> = new Map();
  private timestamps: Map<string, number[]> = new Map();
  private fpsTarget: number;
  private bufferSizeAgg: number;
  private bufferSizePpg: number;
  private bufferSizeResp: number;
  private minBufferSizePpg: number;
  private minBufferSizeResp: number;

  /**
   * Initializes the manager with the provided method configuration.
   * @param methodConfig - The method configuration.
   */
  constructor(private methodConfig: MethodConfig, private options: VitalLensOptions) {
    this.fpsTarget = this.options.overrideFpsTarget ?? this.methodConfig.fpsTarget;
    this.bufferSizeAgg = this.fpsTarget * AGG_WINDOW_SIZE;
    this.bufferSizePpg = this.fpsTarget * CALC_HR_WINDOW_SIZE;
    this.bufferSizeResp = this.fpsTarget * CALC_RR_WINDOW_SIZE;
    this.minBufferSizePpg = this.fpsTarget * CALC_HR_MIN_WINDOW_SIZE;
    this.minBufferSizeResp = this.fpsTarget * CALC_RR_MIN_WINDOW_SIZE;
  }

  /**
   * Processes an incremental result and aggregates it into the buffer.
   * @param incrementalResult - The incremental result to process.
   * @param sourceId - The source identifier (e.g., streamId or videoId).
   * @param defaultWaveformDataMode - The default waveformDataMode to set.
   * @returns The aggregated result.
   */
  async processIncrementalResult(
    incrementalResult: VitalLensResult,
    sourceId: string,
    defaultWaveformDataMode: string
  ): Promise<VitalLensResult> {
    const { ppgWaveform, respiratoryWaveform } = incrementalResult.vitals;

    const waveformDataMode = this.options.waveformDataMode || defaultWaveformDataMode;

    if (!ppgWaveform && !respiratoryWaveform) {
      throw new Error("No waveform data found in incremental result.");
    }

    // Initialize buffers and timestamps for the source ID
    if (!this.timestamps.has(sourceId)) this.timestamps.set(sourceId, []);
    if (!this.waveformBuffers.has(sourceId)) {
      this.waveformBuffers.set(sourceId, { ppg: { sum: [], count: [] }, resp: { sum: [], count: [] } });
    }

    // Update timestamps
    this.updateTimestamps(sourceId, incrementalResult.time, waveformDataMode);
    
    // Update waveforms
    const waveformBuffer = this.waveformBuffers.get(sourceId)!;
    if (ppgWaveform) this.updateWaveform(waveformBuffer.ppg, ppgWaveform, this.bufferSizePpg, waveformDataMode);
    if (respiratoryWaveform) this.updateWaveform(waveformBuffer.resp, respiratoryWaveform, this.bufferSizeResp, waveformDataMode);

    // TODO: Mirror the result structure from vitallens-python with confidences, units, notes, disclaimer ...

    return await this.computeAggregatedResult(sourceId, waveformDataMode, incrementalResult.time, incrementalResult.vitals.ppgWaveform, incrementalResult.vitals.respiratoryWaveform);
  }

  /**
   * Updates the stored timestamps for a given source ID
   * @param sourceId - The unique identifier for the data source (e.g., streamId or videoId).
   * @param newTimestamps - An array of new timestamps to be appended.
   * @param waveformDataMode - Defines the mode for waveform data management:
   */
  private updateTimestamps(
    sourceId: string,
    newTimestamps: number[],
    waveformDataMode: string
  ): void {
    const currentTimestamps = this.timestamps.get(sourceId)!;
    const overlap = Math.min(this.methodConfig.windowOverlap, currentTimestamps.length);
    const nonOverlappingTimestamps = newTimestamps.slice(overlap);
    currentTimestamps.push(...nonOverlappingTimestamps);
    if (waveformDataMode === "complete") return;
    const maxBufferSize = Math.max(this.bufferSizePpg, this.bufferSizeResp);
    if (currentTimestamps.length > maxBufferSize) {
      this.timestamps.set(sourceId, currentTimestamps.slice(-maxBufferSize));
    }
  }

  /**
   * Updates waveforms by maintaining a sum and count for overlap handling.
   * @param buffer - The existing waveform buffer with sum and count tensors.
   * @param incremental - The new incremental waveform tensor.
   * @param maxBufferSize - The maximum buffer size for the waveform.
   * @param waveformDataMode - Sets how much of waveforms is returned to user.
   */
  private updateWaveform(
    buffer: { sum: number[]; count: number[] },
    incremental: number[],
    maxBufferSize: number,
    waveformDataMode: string
  ): void {
    const overlap = this.methodConfig.windowOverlap;
    const overlapSize = Math.min(overlap, buffer.sum.length);

    // Initialize sum and count arrays if not already set
    if (buffer.sum.length === 0 || buffer.count.length === 0) {
      buffer.sum = [...incremental];
      buffer.count = Array(incremental.length).fill(1);
      return;
    }
    
    // Handle the overlapping region
    const existingTailSum = buffer.sum.slice(-overlapSize);
    const incrementalHead = incremental.slice(0, overlapSize);
    
    const updatedTailSum = existingTailSum.map((val, idx) => val + incrementalHead[idx]);
    const updatedTailCount = buffer.count.slice(-overlapSize).map((val) => val + 1);
    
    // Handle the non-overlapping region
    const nonOverlappingSum = incremental.slice(overlapSize);
    const nonOverlappingCount = Array(nonOverlappingSum.length).fill(1);
    
    // Concatenate updated and non-overlapping regions
    buffer.sum = [
      ...buffer.sum.slice(0, -overlapSize), // Keep the initial part
      ...updatedTailSum, // Update the overlapping part
      ...nonOverlappingSum, // Append the new non-overlapping region
    ];

    buffer.count = [
      ...buffer.count.slice(0, -overlapSize), // Keep the initial part
      ...updatedTailCount, // Update the overlapping part
      ...nonOverlappingCount, // Append the new non-overlapping region
    ];

    // Trim buffers to maximum size if necessary
    if (waveformDataMode !== "complete" && buffer.sum.length > maxBufferSize) {
      buffer.sum = buffer.sum.slice(-maxBufferSize);
      buffer.count = buffer.count.slice(-maxBufferSize);
    }
  }

  /**
   * Computes the aggregated result by performing FFT and extracting vitals.
   * @param sourceId - The source identifier.
   * @param waveformDataMode - Sets how much of waveforms is returned to user.
   * @param incrementalTime - The latest incremental timestamps - pass if returning incremental vals.
   * @param incrementalPpg - The latest incremental PPG waveform - pass if returning incremental vals.
   * @param incrementalResp - The latest incremental respiratory waveform - pass if returning incremental vals.
   * @returns The aggregated VitalLensResult.
   */
  private async computeAggregatedResult(
    sourceId: string,
    waveformDataMode: string,
    incrementalTime?: number[],
    incrementalPpg?: number[],
    incrementalResp?: number[]
  ): Promise<VitalLensResult> {
    const waveformBuffer = this.waveformBuffers.get(sourceId)!;
    const timestamps = this.timestamps.get(sourceId);
    const result: VitalLensResult = { vitals: {}, state: null, time: [] };

    if (timestamps) {
      switch (waveformDataMode) {
        case 'incremental':
          const overlapSize = incrementalTime ? Math.min(this.methodConfig.windowOverlap, incrementalTime.length) : 0;
          result.time = incrementalTime ? incrementalTime.slice(overlapSize) : [];
          break;
        case 'aggregated':
          result.time = timestamps.slice(-this.bufferSizeAgg);
          break;
        case 'complete':
          result.time = timestamps;
          break;
      }
    }
    
    if (waveformBuffer) {
      // PPG
      const averagedPpg = waveformBuffer.ppg.sum.map((val, i) => val / waveformBuffer.ppg.count[i]);
      switch (waveformDataMode) {
        case 'incremental':
          const overlapSize = incrementalPpg ? Math.min(this.methodConfig.windowOverlap, incrementalPpg.length) : 0;
          result.vitals.ppgWaveform = incrementalPpg ? incrementalPpg.slice(overlapSize) : [];
          break;
        case 'aggregated':
          result.vitals.ppgWaveform = averagedPpg.slice(-this.bufferSizeAgg);
          break;
        case 'complete':
          result.vitals.ppgWaveform = averagedPpg;
          break;
      }
      if (waveformBuffer.ppg.sum.length >= this.minBufferSizePpg) {
        const fps = this.getCurrentFps(sourceId, this.bufferSizePpg);
        if (fps) {
          result.vitals.heartRate = this.estimateHeartRate(averagedPpg.slice(-this.bufferSizePpg), fps);
        }
      }

      // RESP
      const averagedResp = waveformBuffer.resp.sum.map((val, i) => val / waveformBuffer.resp.count[i]);
      switch (waveformDataMode) {
        case 'incremental':
          const overlapSize = incrementalResp ? Math.min(this.methodConfig.windowOverlap, incrementalResp.length) : 0;
          result.vitals.respiratoryWaveform = incrementalResp ? incrementalResp.slice(overlapSize) : [];
          break;
        case 'aggregated':
          result.vitals.respiratoryWaveform = averagedResp.slice(-this.bufferSizeAgg);
          break;
        case 'complete':
          result.vitals.respiratoryWaveform = averagedResp;
          break;
      }
      
      if (waveformBuffer.resp.sum.length >= this.minBufferSizeResp) {
        const fps = this.getCurrentFps(sourceId, this.bufferSizeResp);
        if (fps) {
          result.vitals.respiratoryRate = this.estimateRespiratoryRate(averagedResp.slice(-this.bufferSizeResp), fps);
        }
      }
    }

    return result;
  }

  /**
   * Computes the current average fps according to the most recent up to `bufferSize` timestamps.
   * @param sourceId - The source identifier.
   * @param bufferSize - The maximum number of recent timestamps to take into account.
   * @returns The current average fps.
   */
  private getCurrentFps(sourceId: string, bufferSize: number): number | null {
    const timestamps = this.timestamps.get(sourceId)?.slice(-bufferSize);
    if (!timestamps || timestamps.length < 2) {
      return null;
    }
    const timeDiffs = timestamps.slice(1).map((t, i) => t - timestamps[i]);
    const avgTimeDiff = timeDiffs.reduce((acc, val) => acc + val, 0) / timeDiffs.length;
    return avgTimeDiff > 0 ? 1 / avgTimeDiff : null;
  }
  
  /**
   * Estimates heart rate from the PPG waveform using FFT.
   * @param ppgWaveform - The PPG waveform tensor.
   * @param fs - The sampling rate of the waveform tensor (cycles per second)
   * @returns The estimated heart rate in beats per minute.
   */
  private estimateHeartRate(ppgWaveform: number[], fs: number): number {
    const heartRate = this.estimateRateFromFFT(ppgWaveform, fs, CALC_HR_MIN / 60, CALC_HR_MAX / 60);
    if (heartRate === null) throw new Error("Failed to estimate heart rate.");
    return heartRate;
  }

  /**
   * Estimates respiratory rate from the respiratory waveform using FFT.
   * @param respiratoryWaveform - The respiratory waveform tensor.
   * @param fs - The sampling rate of the waveform tensor (cycles per second)
   * @returns The estimated respiratory rate in breaths per minute.
   */
  private estimateRespiratoryRate(respiratoryWaveform: number[], fs: number): number {
    const respiratoryRate = this.estimateRateFromFFT(respiratoryWaveform, fs, CALC_RR_MIN / 60, CALC_RR_MAX / 60);
    if (respiratoryRate === null) throw new Error("Failed to estimate respiratory rate.");
    return respiratoryRate;
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
  private estimateRateFromFFT(
    waveform: number[],
    samplingFrequency: number,
    minFrequency: number,
    maxFrequency: number,
    desiredResolutionHz?: number
  ): number | null {
    if (waveform.length === 0 || samplingFrequency <= 0 || minFrequency >= maxFrequency) {
      throw new Error("Invalid waveform data, sampling frequency, or frequency range.");
    }

    // Calculate the required FFT size to achieve the desired resolution
    let fftSize: number = Math.pow(2, Math.ceil(Math.log2(waveform.length)));
    if (desiredResolutionHz) {
      const desiredFftSize = Math.ceil(samplingFrequency / desiredResolutionHz);
      fftSize = Math.max(fftSize, Math.pow(2, Math.ceil(Math.log2(desiredFftSize))));
    }
  
    const paddedSignal: number[] = [...waveform, ...Array(fftSize - waveform.length).fill(0)];
    const fft = new FFT(fftSize);
  
    const complexArray: any[] = fft.createComplexArray();
    const outputArray: any[] = fft.createComplexArray();
    fft.toComplexArray(paddedSignal, complexArray);
  
    fft.realTransform(outputArray, paddedSignal);
  
    const magnitudes: number[] = [];
    for (let i = 0; i < fftSize / 2; i++) {
      const real = outputArray[2 * i];
      const imag = outputArray[2 * i + 1];
      magnitudes.push(Math.sqrt(real ** 2 + imag ** 2));
    }
  
    const nyquist: number = samplingFrequency / 2;
    const frequencies: number[] = Array.from({ length: magnitudes.length }, (_, i) => (i / magnitudes.length) * nyquist);

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
   * Returns the aggregated VitalLensResult for the user.
   * @param sourceId - The source identifier.
   * @returns The aggregated VitalLensResult.
   */
  async getResult(sourceId: string): Promise<VitalLensResult> {
    return await this.computeAggregatedResult(sourceId, "complete");
  }
}
