import * as tf from '@tensorflow/tfjs';
import { MethodConfig } from "../config/methodsConfig";
import { VitalLensResult } from "../types/core";
import { IVitalsEstimateManager } from '../types/IVitalsEstimateManager';
import { CALC_HR_WINDOW_SIZE, CALC_RR_WINDOW_SIZE } from '../config/constants';

export class VitalsEstimateManager implements IVitalsEstimateManager {
  private waveformBuffers: Map<string, { ppg: { sum: tf.Tensor | null; count: tf.Tensor | null }, resp: { sum: tf.Tensor | null; count: tf.Tensor | null } }> = new Map();
  private timestamps: Map<string, number[]> = new Map();
  private maxBufferSizePpg: number = 0; // Max buffer size for PPG
  private maxBufferSizeResp: number = 0; // Max buffer size for Resp

  /**
   * Initializes the manager with the provided method configuration.
   * @param methodConfig - The method configuration.
   */
  constructor(private methodConfig: MethodConfig) {
    this.maxBufferSizePpg = methodConfig.fpsTarget * CALC_HR_WINDOW_SIZE;
    this.maxBufferSizeResp = methodConfig.fpsTarget * CALC_RR_WINDOW_SIZE;
  }

  /**
   * Processes an incremental result and aggregates it into the buffer.
   * @param incrementalResult - The incremental result to process.
   * @param sourceId - The source identifier (e.g., streamId or videoId).
   * @returns The aggregated result.
   */
  // TODO: Review/test this code
  async processIncrementalResult(incrementalResult: VitalLensResult, sourceId: string): Promise<VitalLensResult> {
    const { ppgWaveform, respiratoryWaveform } = incrementalResult.vitals;

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

    const currentTimestamps = this.timestamps.get(sourceId)!;
    const currentLength = ppgWaveform ? ppgWaveform.size : respiratoryWaveform!.size;
    const newTimestamps = Array.from({ length: currentLength }, (_, i) => currentTimestamps.length + i);

    // Update timestamps
    currentTimestamps.push(...newTimestamps);

    // Keep timestamps within buffer limits
    if (currentTimestamps.length > this.maxBufferSizePpg) {
      this.timestamps.set(sourceId, currentTimestamps.slice(-this.maxBufferSizePpg));
    }

    const waveformBuffer = this.waveformBuffers.get(sourceId)!;

    // TODO: Adapt to number[] being used in VitalLensResult

    // Aggregate waveforms
    if (ppgWaveform) {
      this.aggregateWaveform(waveformBuffer.ppg, ppgWaveform, this.maxBufferSizePpg);
    }

    if (respiratoryWaveform) {
      this.aggregateWaveform(waveformBuffer.resp, respiratoryWaveform, this.maxBufferSizeResp);
    }

    // Compute aggregated results
    // TODO: pass incrementalPpg and incrementalResp when appropriate
    return this.computeAggregatedResult(sourceId);
  }

  /**
   * Aggregates waveforms by maintaining a sum and count for overlap handling.
   * @param buffer - The existing waveform buffer with sum and count tensors.
   * @param incremental - The new incremental waveform tensor.
   * @param maxBufferSize - The maximum buffer size for the waveform.
   */
  // TODO: Review/test this code
  private aggregateWaveform(buffer: { sum: tf.Tensor | null; count: tf.Tensor | null }, incremental: tf.Tensor, maxBufferSize: number): void {
    const overlap = this.methodConfig.windowOverlap;

    if (!buffer.sum || !buffer.count) {
      buffer.sum = incremental;
      buffer.count = tf.onesLike(incremental);
      return;
    }

    tf.tidy(() => {
      const overlapSize = overlap;
      const newSize = incremental.shape[0];

      const existingTailSum = buffer.sum.slice(-overlapSize);
      const incrementalHead = incremental.slice(0, overlapSize);

      const updatedTailSum = tf.add(existingTailSum, incrementalHead);
      const updatedTailCount = tf.add(buffer.count.slice(-overlapSize), tf.onesLike(incrementalHead));

      const nonOverlappingSum = incremental.slice(overlapSize, newSize);
      const nonOverlappingCount = tf.onesLike(nonOverlappingSum);

      const newSum = tf.concat([buffer.sum.slice(0, -overlapSize), updatedTailSum, nonOverlappingSum]);
      const newCount = tf.concat([buffer.count.slice(0, -overlapSize), updatedTailCount, nonOverlappingCount]);

      buffer.sum.dispose();
      buffer.count.dispose();

      buffer.sum = newSum.slice(-maxBufferSize);
      buffer.count = newCount.slice(-maxBufferSize);
    });
  }

  /**
   * Computes the aggregated result by performing FFT and extracting vitals.
   * @param sourceId - The source identifier.
   * @param incrementalPpg - The latest incremental PPG waveform.
   * @param incrementalResp - The latest incremental respiratory waveform.
   * @returns The aggregated VitalLensResult.
   */
  // TODO: Review/test this code
  private computeAggregatedResult(sourceId: string, incrementalPpg?: tf.Tensor, incrementalResp?: tf.Tensor): VitalLensResult {
    const waveformBuffer = this.waveformBuffers.get(sourceId)!;
    const result: VitalLensResult = { vitals: {}, state: null };

    if (waveformBuffer.ppg.sum && waveformBuffer.ppg.count) {
      const averagedPpg = tf.tidy(() => tf.div(waveformBuffer.ppg.sum!, waveformBuffer.ppg.count!));
      result.vitals.heartRate = this.estimateHeartRate(averagedPpg);
      result.vitals.ppgWaveform = incrementalPpg ? Array.from(incrementalPpg.dataSync()) : Array.from(averagedPpg.dataSync());
      averagedPpg.dispose();
    }

    if (waveformBuffer.resp.sum && waveformBuffer.resp.count) {
      const averagedResp = tf.tidy(() => tf.div(waveformBuffer.resp.sum!, waveformBuffer.resp.count!));
      result.vitals.respiratoryRate = this.estimateRespiratoryRate(averagedResp);
      result.vitals.respiratoryWaveform = incrementalResp ? Array.from(incrementalResp.dataSync()) : Array.from(averagedResp.dataSync());
      averagedResp.dispose();
    }

    return result;
  }

  /**
   * Estimates heart rate from the PPG waveform using FFT.
   * @param ppgWaveform - The PPG waveform tensor.
   * @returns The estimated heart rate in beats per minute.
   */
  private estimateHeartRate(ppgWaveform: tf.Tensor): number {
    // TODO: Pass min/max for hr
    return this.estimateRateFromFFT(ppgWaveform);
  }

  /**
   * Estimates respiratory rate from the respiratory waveform using FFT.
   * @param respiratoryWaveform - The respiratory waveform tensor.
   * @returns The estimated respiratory rate in breaths per minute.
   */
  private estimateRespiratoryRate(respiratoryWaveform: tf.Tensor): number {
    // TODO: Pass min/max for rr
    return this.estimateRateFromFFT(respiratoryWaveform);
  }

  /**
   * Estimates a rate (e.g., heart rate or respiratory rate) from a waveform using FFT.
   * @param waveform - The input waveform tensor.
   * @returns The estimated rate in cycles per minute.
   */
  // TODO: Review/test this code
  // TODO: Allow min/max freq args
  private estimateRateFromFFT(waveform: tf.Tensor): number {
    const fftResult = tf.tidy(() => {
      const fft = tf.spectral.fft(waveform);
      const powerSpectrum = fft.abs().square();
      return powerSpectrum;
    });

    // Find peak frequency (simple example, refine for real application)
    const maxIndex = tf.argMax(fftResult).dataSync()[0];
    const samplingRate = this.methodConfig.fpsTarget; // Samples per second
    const frequency = (maxIndex * samplingRate) / waveform.size; // Cycles per second

    fftResult.dispose();

    return frequency * 60; // Convert to cycles per minute
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
