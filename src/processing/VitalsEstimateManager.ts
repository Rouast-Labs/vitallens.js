import * as tf from '@tensorflow/tfjs';
import { MethodConfig } from "../config/methodsConfig";
import { VitalLensOptions, VitalLensResult } from "../types/core";
import { IVitalsEstimateManager } from '../types/IVitalsEstimateManager';
import { AGG_WINDOW_SIZE, CALC_HR_MAX, CALC_HR_MIN, CALC_HR_MIN_WINDOW_SIZE, CALC_HR_WINDOW_SIZE, CALC_RR_MAX, CALC_RR_MIN, CALC_RR_MIN_WINDOW_SIZE, CALC_RR_WINDOW_SIZE } from '../config/constants';

export class VitalsEstimateManager implements IVitalsEstimateManager {
  private waveformBuffers: Map<string, { ppg: { sum: tf.Tensor | null; count: tf.Tensor | null }, resp: { sum: tf.Tensor | null; count: tf.Tensor | null } }> = new Map();
  private timestamps: Map<string, number[]> = new Map();
  private fpsTarget: number;
  private bufferSizeAgg: number; // Buffer size for Aggregated results
  private bufferSizePpg: number; // Buffer size for PPG
  private bufferSizeResp: number; // Buffer size for Resp
  private minBufferSizePpg: number;
  private minBufferSizeResp: number;

  /**
   * Initializes the manager with the provided method configuration.
   * @param methodConfig - The method configuration.
   */
  constructor(private methodConfig: MethodConfig, private options: VitalLensOptions) {
    this.fpsTarget = this.options.overrideFpsTarget ? this.options.overrideFpsTarget : this.methodConfig.fpsTarget;
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
  async processIncrementalResult(incrementalResult: VitalLensResult, sourceId: string, defaultWaveformDataMode: string): Promise<VitalLensResult> {
    const { ppgWaveform, respiratoryWaveform } = incrementalResult.vitals;

    const waveformDataMode = this.options.waveformDataMode || defaultWaveformDataMode;

    if (!ppgWaveform && !respiratoryWaveform) {
      throw new Error("No waveform data found in incremental result.");
    }

    if (!this.timestamps.has(sourceId)) {
      this.timestamps.set(sourceId, []);
    }

    if (!this.waveformBuffers.has(sourceId)) {
      this.waveformBuffers.set(sourceId, {
        ppg: { sum: null, count: null },
        resp: { sum: null, count: null }
      });
    }

    // Aggregate timestamps
    const currentTimestamps = this.timestamps.get(sourceId)!;
    const overlap = this.methodConfig.windowOverlap;

    const newTimestamps = incrementalResult.time;
    const nonOverlappingTimestamps = newTimestamps.slice(overlap);

    currentTimestamps.push(...nonOverlappingTimestamps);

    if (waveformDataMode !== 'complete') {
      const maxBufferSize = Math.max(this.bufferSizePpg, this.bufferSizeResp);
      if (currentTimestamps.length > maxBufferSize) {
        this.timestamps.set(sourceId, currentTimestamps.slice(-maxBufferSize));
      }
    }
    
    const waveformBuffer = this.waveformBuffers.get(sourceId)!;

    // Aggregate waveforms
    if (ppgWaveform) {
      this.aggregateWaveform(waveformBuffer.ppg, ppgWaveform, this.bufferSizePpg, waveformDataMode);
    }

    if (respiratoryWaveform) {
      this.aggregateWaveform(waveformBuffer.resp, respiratoryWaveform, this.bufferSizeResp, waveformDataMode);
    }

    // TODO: Mirror the result structure from vitallens-python with confidences, units, notes, disclaimer ...

    return this.computeAggregatedResult(sourceId, waveformDataMode, incrementalResult.time, incrementalResult.vitals.ppgWaveform, incrementalResult.vitals.respiratoryWaveform);
  }

  /**
   * Aggregates waveforms by maintaining a sum and count for overlap handling.
   * @param buffer - The existing waveform buffer with sum and count tensors.
   * @param incremental - The new incremental waveform tensor.
   * @param waveformDataMode - Sets how much of waveforms is returned to user.
   * @param maxBufferSize - The maximum buffer size for the waveform.
   */
  private aggregateWaveform(buffer: { sum: tf.Tensor | null; count: tf.Tensor | null }, incremental: number[], maxBufferSize: number, waveformDataMode: string): void {
    const overlap = this.methodConfig.windowOverlap;
    const incrementalTensor = tf.tensor(incremental);

    if (!buffer.sum || !buffer.count) {
      buffer.sum = incrementalTensor;
      buffer.count = tf.onesLike(incremental);
      return;
    }

    tf.tidy(() => {
      const overlapSize = overlap;

      const existingTailSum = buffer.sum!.slice(-overlapSize);
      const incrementalHead = incrementalTensor.slice(0, overlapSize);

      const updatedTailSum = tf.add(existingTailSum, incrementalHead);
      const updatedTailCount = tf.add(buffer.count!.slice(-overlapSize), tf.onesLike(incrementalHead));

      const nonOverlappingSum = incrementalTensor.slice(overlapSize);
      const nonOverlappingCount = tf.onesLike(nonOverlappingSum.shape[0]);

      const newSum = tf.concat([buffer.sum!.slice(0, -overlapSize), updatedTailSum, nonOverlappingSum]);
      const newCount = tf.concat([buffer.count!.slice(0, -overlapSize), updatedTailCount, nonOverlappingCount]);

      buffer.sum!.dispose();
      buffer.count!.dispose();

      buffer.sum = waveformDataMode === 'complete' ? newSum : newSum.slice(-maxBufferSize);
      buffer.count = waveformDataMode === 'complete' ? newCount : newCount.slice(-maxBufferSize);
    });

    incrementalTensor.dispose();
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
  private computeAggregatedResult(sourceId: string, waveformDataMode: string, incrementalTime?: number[], incrementalPpg?: number[], incrementalResp?: number[]): VitalLensResult {
    const waveformBuffer = this.waveformBuffers.get(sourceId)!;
    const timestamps = this.timestamps.get(sourceId);
    const result: VitalLensResult = { vitals: {}, state: null, time: [] };

    if (timestamps) {
      switch (waveformDataMode) {
        case 'incremental':
          result.time = incrementalTime ? incrementalTime : [];
          break;
        case 'aggregated':
          result.time = timestamps.slice(-this.bufferSizeAgg);
          break;
        case 'complete':
          result.time = timestamps;
          break;
      }
    }
    
    if (waveformBuffer.ppg.sum && waveformBuffer.ppg.count) {
      const averagedPpg = tf.tidy(() => tf.div(waveformBuffer.ppg.sum!, waveformBuffer.ppg.count!));
      
      switch (waveformDataMode) {
        case 'incremental':
          result.vitals.ppgWaveform = incrementalPpg ? incrementalPpg : [];
          break;
        case 'aggregated':
          result.vitals.ppgWaveform = Array.from(averagedPpg.slice(-this.bufferSizeAgg).dataSync());
          break;
        case 'complete':
          result.vitals.ppgWaveform = Array.from(averagedPpg.dataSync());
          break;
      }
      
      if (averagedPpg.size >= this.minBufferSizePpg) {
        const fps = this.getCurrentFps(sourceId, this.bufferSizePpg);
        if (fps) {
          result.vitals.heartRate = this.estimateHeartRate(averagedPpg.slice(-this.bufferSizePpg), fps);
        }
      }

      averagedPpg.dispose();
    }

    if (waveformBuffer.resp.sum && waveformBuffer.resp.count) {
      const averagedResp = tf.tidy(() => tf.div(waveformBuffer.resp.sum!, waveformBuffer.resp.count!));
      
      switch (waveformDataMode) {
        case 'incremental':
          result.vitals.respiratoryWaveform = incrementalResp ? incrementalResp : [];
          break;
        case 'aggregated':
          result.vitals.respiratoryWaveform = Array.from(averagedResp.slice(-this.bufferSizeAgg).dataSync());
          break;
        case 'complete':
          result.vitals.respiratoryWaveform = Array.from(averagedResp.dataSync());
          break;
      }
      
      if (averagedResp.size >= this.minBufferSizeResp) {
        const fps = this.getCurrentFps(sourceId, this.bufferSizeResp);
        if (fps) {
          result.vitals.respiratoryRate = this.estimateRespiratoryRate(averagedResp.slice(-this.bufferSizeResp), fps);
        }
      }

      averagedResp.dispose();
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
  private estimateHeartRate(ppgWaveform: tf.Tensor, fs: number): number {
    return this.estimateRateFromFFT(ppgWaveform, fs, CALC_HR_MIN/60, CALC_HR_MAX/60);
  }

  /**
   * Estimates respiratory rate from the respiratory waveform using FFT.
   * @param respiratoryWaveform - The respiratory waveform tensor.
   * @param fs - The sampling rate of the waveform tensor (cycles per second)
   * @returns The estimated respiratory rate in breaths per minute.
   */
  private estimateRespiratoryRate(respiratoryWaveform: tf.Tensor, fs: number): number {
    return this.estimateRateFromFFT(respiratoryWaveform, fs, CALC_RR_MIN/60, CALC_RR_MAX/60);
  }

  /**
   * Estimates a rate (e.g., heart rate or respiratory rate in 1/min) from a waveform using FFT,
   * constrained by min and max frequencies.
   * @param waveform - The input waveform tensor.
   * @param fs - The sampling rate of the waveform tensor (cycles per second)
   * @param fMin - The minimum frequency of interest (cycles per second).
   * @param fMax - The maximum frequency of interest (cycles per second).
   * @returns The estimated rate in cycles per minute.
   */
  private estimateRateFromFFT(waveform: tf.Tensor, fs: number, fMin: number, fMax: number): number {
    const fftResult = tf.tidy(() => {
      const fft = tf.spectral.fft(waveform);
      const powerSpectrum = fft.abs().square();
      // Compute the frequency bins
      const numBins = powerSpectrum.size;
      const frequencies = tf.linspace(0, fs / 2, Math.floor(numBins / 2));
      // Extract the valid range indices
      const validRange = frequencies.where(
        frequencies.greaterEqual(fMin).logicalAnd(frequencies.lessEqual(fMax))
      );
      const validPower = powerSpectrum.slice(0, validRange.shape[0]);
      return { validPower, validRange, frequencies };
    });

    const { validPower, validRange, frequencies } = fftResult;

    const maxIndex = tf.argMax(validPower).dataSync()[0];
    const peakFrequency = frequencies.gather(tf.scalar(maxIndex, 'int32')).dataSync()[0];

    fftResult.validPower.dispose();
    fftResult.validRange.dispose();
    fftResult.frequencies.dispose();

    return peakFrequency * 60; // Convert to cycles per minute
  }

  /**
   * Returns the aggregated VitalLensResult for the user.
   * @param sourceId - The source identifier.
   * @returns The aggregated VitalLensResult.
   */
  getResult(sourceId: string): VitalLensResult {
    return this.computeAggregatedResult(sourceId);
  }
}
