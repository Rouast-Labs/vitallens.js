import { MethodConfig } from "../config/methodsConfig";
import { VitalLensOptions, VitalLensResult } from "../types/core";
import { IVitalsEstimateManager } from '../types/IVitalsEstimateManager';
import { 
  AGG_WINDOW_SIZE, CALC_HR_MAX, CALC_HR_MIN, CALC_HR_MIN_WINDOW_SIZE, CALC_HR_WINDOW_SIZE, 
  CALC_RR_MAX, CALC_RR_MIN, CALC_RR_MIN_WINDOW_SIZE, CALC_RR_WINDOW_SIZE 
} from '../config/constants';
import FFT from "fft.js";

export class VitalsEstimateManager implements IVitalsEstimateManager {
  private waveforms: Map<string, { 
    ppgData: { sum: number[]; count: number[] },
    ppgConf: { sum: number[]; count: number[] },
    respData: { sum: number[]; count: number[] },
    respConf: { sum: number[]; count: number[] }
  }> = new Map();
  private waveformNotes: Map<string, { ppg: string, resp: string }> = new Map();
  private timestamps: Map<string, number[]> = new Map();
  private faces: Map<string, { coordinates: [number, number, number, number][], confidence: number[] }> = new Map();
  private faceNote: Map<string, string> = new Map();
  private message: Map<string, string> = new Map();
  private lastEstimateTimestamps: Map<string, number> = new Map();
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
    const currentTime = performance.now();
    const ppgWaveformData = incrementalResult.vital_signs?.ppg_waveform?.data;
    const ppgWaveformConf = incrementalResult.vital_signs?.ppg_waveform?.confidence;
    const respiratoryWaveformData = incrementalResult.vital_signs?.respiratory_waveform?.data;
    const respiratoryWaveformConf = incrementalResult.vital_signs?.respiratory_waveform?.confidence;
    const waveformDataMode = this.options.waveformDataMode || defaultWaveformDataMode;

    if ((!ppgWaveformData || !ppgWaveformConf) && (!respiratoryWaveformData || !respiratoryWaveformConf)) {
      throw new Error("No waveform data found in incremental result.");
    }

    // Initialize buffers, timestamps, and faces for the source ID
    if (!this.timestamps.has(sourceId)) this.timestamps.set(sourceId, []);
    if (!this.faces.has(sourceId)) this.faces.set(sourceId, { coordinates: [], confidence: [] });
    if (!this.waveforms.has(sourceId)) {
      this.waveforms.set(sourceId, {
        ppgData: { sum: [], count: [] }, ppgConf: { sum: [], count: [] },
        respData: { sum: [], count: [] }, respConf: { sum: [], count: [] }
      });
    }
    if (!this.waveformNotes.has(sourceId)) this.waveformNotes.set(sourceId, { ppg: "", resp: "" });
    if (!this.faceNote.has(sourceId)) this.faceNote.set(sourceId, "");
    if (!this.message.has(sourceId)) this.message.set(sourceId, "");

    // Update timestamps
    this.updateTimestamps(sourceId, incrementalResult.time, waveformDataMode);

    // Update faces
    if (incrementalResult.face) this.updateFaces(sourceId, incrementalResult.face, waveformDataMode);
    
    // Update waveforms
    this.updateWaveforms(sourceId, incrementalResult.vital_signs, waveformDataMode);

    // Update message
    if (incrementalResult.message) this.message.set(sourceId, incrementalResult.message);

    // Compute estimation fps
    const lastEstimateTimestamp = this.lastEstimateTimestamps.get(sourceId);
    const estFps = lastEstimateTimestamp ? 1000 / (currentTime - lastEstimateTimestamp) : undefined;
    this.lastEstimateTimestamps.set(sourceId, currentTime);

    return await this.computeAggregatedResult(sourceId, waveformDataMode, incrementalResult, estFps);
  }

  /**
   * Updates an array of values by handling overlap and trimming to a maximum buffer size.   *
   * @template T - The type of the elements in the array (e.g., number, ROI, etc.).
   * @param currentValues - The existing array of values to update.
   * @param addValues - The new values to add to the existing array.
   * @param waveformDataMode - The mode that determines how the array is updated:
   * @returns A new array containing the updated values, with overlap handled and trimmed to the buffer size if required.
   */
  private getUpdatedValues<T>(
    currentValues: T[],
    addValues: T[],
    waveformDataMode: string
  ): T[] {
    const overlap = Math.min(this.methodConfig.windowOverlap, currentValues.length);
    const maxBufferSize = Math.max(this.bufferSizePpg, this.bufferSizeResp);
    const nonOverlappingValues = addValues.slice(overlap);
    const updatedValues = [...currentValues, ...nonOverlappingValues];
    if (waveformDataMode === "complete") {
      return updatedValues;
    }
    if (updatedValues.length > maxBufferSize) {
      return updatedValues.slice(-maxBufferSize);
    }
    return updatedValues;
  }

  /**
   * Updates sum and count arrays by handling overlap and trimming to a maximum buffer size.
   * @param currentBuffer - The existing buffer containing sum and count arrays.
   * @param incremental - The new incremental values to add to the buffer.
   * @param waveformDataMode - Determines if trimming to max buffer size is needed.
   * @param maxBufferSize - The maximum buffer size for the updated arrays.
   * @returns An object containing the updated sum and count arrays.
   */
  private getUpdatedSumCount(
    currentBuffer: { sum: number[]; count: number[] },
    incremental: number[],
    waveformDataMode: string,
    maxBufferSize: number,
  ): { sum: number[]; count: number[] } {
    // Destructure sum and count from current buffer
    let { sum: currentSum, count: currentCount } = currentBuffer;

    // Initialize sum and count arrays if not already set
    if (currentSum.length === 0 || currentCount.length === 0) {
      return {
        sum: [...incremental],
        count: Array(incremental.length).fill(1),
      };
    }

    const overlap = this.methodConfig.windowOverlap;
    const overlapSize = Math.min(overlap, currentSum.length);

    // Handle the overlapping region
    const existingTailSum = currentSum.slice(-overlapSize);
    const incrementalHead = incremental.slice(0, overlapSize);

    const updatedTailSum = existingTailSum.map((val, idx) => val + incrementalHead[idx]);
    const updatedTailCount = currentCount.slice(-overlapSize).map((val) => val + 1);

    // Handle the non-overlapping region
    const nonOverlappingSum = incremental.slice(overlapSize);
    const nonOverlappingCount = Array(nonOverlappingSum.length).fill(1);

    // Concatenate updated and non-overlapping regions
    let updatedSum = [
      ...currentSum.slice(0, -overlapSize), // Keep the initial part
      ...updatedTailSum, // Update the overlapping part
      ...nonOverlappingSum, // Append the new non-overlapping region
    ];

    let updatedCount = [
      ...currentCount.slice(0, -overlapSize), // Keep the initial part
      ...updatedTailCount, // Update the overlapping part
      ...nonOverlappingCount, // Append the new non-overlapping region
    ];

    // Trim buffers to maximum size if necessary
    if (waveformDataMode !== "complete" && updatedSum.length > maxBufferSize) {
      updatedSum = updatedSum.slice(-maxBufferSize);
      updatedCount = updatedCount.slice(-maxBufferSize);
    }

    return { sum: updatedSum, count: updatedCount };
  }


  /**
   * Updates the stored timestamps for a given source ID
   * @param sourceId - The unique identifier for the data source (e.g., streamId or videoId).
   * @param newTimestamps - An array of new timestamps to be appended.
   * @param waveformDataMode - Defines the mode for waveform data management:
   */
  private updateTimestamps(
    sourceId: string,
    newTimestamps: VitalLensResult["time"],
    waveformDataMode: string
  ): void {
    const currentTimestamps = this.timestamps.get(sourceId)!;
    const updatedTimestamps = this.getUpdatedValues(currentTimestamps, newTimestamps, waveformDataMode);
    this.timestamps.set(sourceId, updatedTimestamps);
  }

  /**
   * Updates the stored faces for a given source ID
   * @param sourceId - The unique identifier for the data source (e.g., streamId or videoId).
   * @param newFaces - An array of new faces to be appended.
   * @param waveformDataMode - Defines the mode for waveform data management:
   */
  private updateFaces(
    sourceId: string,
    newFaces: VitalLensResult["face"],
    waveformDataMode: string
  ): void {
    const currentFaces = this.faces.get(sourceId)!;
    if (newFaces.confidence && newFaces.coordinates) {
      const updatedFaceCoordinates = this.getUpdatedValues(currentFaces.coordinates, newFaces.coordinates, waveformDataMode);
      const updatedFaceConfidences = this.getUpdatedValues(currentFaces.confidence, newFaces.confidence, waveformDataMode);
      this.faces.set(sourceId, { coordinates: updatedFaceCoordinates, confidence: updatedFaceConfidences }); 
    }
    if (newFaces.note) this.faceNote.set(sourceId, newFaces.note);
  }

  /**
   * Updates the waveform buffers for a given source ID.
   * @param sourceId - The identifier for the data source (e.g., device or session ID).
   * @param newVitals - New waveform data and confidence values from `VitalLensResult.vital_signs`.
   * @param waveformDataMode - Specifies whether to trim buffers ("incremental") or keep all data ("complete").
   */
  private updateWaveforms(
    sourceId: string,
    newVitals: VitalLensResult["vital_signs"],
    waveformDataMode: string
  ): void {
    const currentWaveforms = this.waveforms.get(sourceId) || {
      ppgData: { sum: [], count: [] }, ppgConf: { sum: [], count: [] },
      respData: { sum: [], count: [] }, respConf: { sum: [], count: [] }
    };
    const currentWaveformNotes = this.waveformNotes.get(sourceId) || { ppg: "", resp: "" }

    let updatedPpgData = currentWaveforms.ppgData;
    let updatedPpgConf = currentWaveforms.ppgConf;
    let updatedRespData = currentWaveforms.respData;
    let updatedRespConf = currentWaveforms.respConf;
    let ppgNote = currentWaveformNotes.ppg;
    let respNote = currentWaveformNotes.resp;

    if (newVitals.ppg_waveform?.data && newVitals.ppg_waveform?.confidence){
      updatedPpgData = this.getUpdatedSumCount(currentWaveforms.ppgData, newVitals.ppg_waveform.data, waveformDataMode, this.bufferSizePpg);
      updatedPpgConf = this.getUpdatedSumCount(currentWaveforms.ppgConf, newVitals.ppg_waveform.confidence, waveformDataMode, this.bufferSizePpg);
    }

    if (newVitals.ppg_waveform?.note) ppgNote = newVitals.ppg_waveform.note;

    if (newVitals.respiratory_waveform?.data && newVitals.respiratory_waveform?.confidence){
      updatedRespData = this.getUpdatedSumCount(currentWaveforms.respData, newVitals.respiratory_waveform.data, waveformDataMode, this.bufferSizeResp);
      updatedRespConf = this.getUpdatedSumCount(currentWaveforms.respConf, newVitals.respiratory_waveform.confidence, waveformDataMode, this.bufferSizeResp);
    }
    
    if (newVitals.respiratory_waveform?.note) respNote = newVitals.respiratory_waveform.note;
    
    this.waveforms.set(sourceId, {
      ppgData: updatedPpgData, ppgConf: updatedPpgConf,
      respData: updatedRespData, respConf: updatedRespConf
    });

    this.waveformNotes.set(sourceId, { ppg: ppgNote, resp: respNote });
  }

  /**
   * Computes the aggregated result by performing FFT and extracting vitals.
   * @param sourceId - The source identifier.
   * @param waveformDataMode - Sets how much of waveforms is returned to user.
   * @param incrementalResult - The latest incremental result - pass if returning incrementally
   * @param estFps - The rate at which estimates are being computed.
   * @returns The aggregated VitalLensResult.
   */
  private async computeAggregatedResult(
    sourceId: string,
    waveformDataMode: string,
    incrementalResult?: any,
    estFps?: number
  ): Promise<VitalLensResult> {
    const waveforms = this.waveforms.get(sourceId)!;
    const waveformNotes = this.waveformNotes.get(sourceId)!;
    const timestamps = this.timestamps.get(sourceId);
    const faces = this.faces.get(sourceId);
    const message = this.message.get(sourceId);
    const result: VitalLensResult = { face: {}, vital_signs: {}, time: [], message: "" };

    if (timestamps) {
      switch (waveformDataMode) {
        case 'incremental':
          const overlapSize = incrementalResult.time ? Math.min(this.methodConfig.windowOverlap, incrementalResult.time.length) : 0;
          result.time = incrementalResult.time ? incrementalResult.time.slice(overlapSize) : [];
          break;
        case 'aggregated':
          result.time = timestamps.slice(-this.bufferSizeAgg);
          break;
        case 'complete':
          result.time = timestamps;
          break;
      }
    }

    if (faces) {
      switch (waveformDataMode) {
        case 'incremental':
          const overlapSize = incrementalResult.face.coordinates ? Math.min(this.methodConfig.windowOverlap, incrementalResult.face.coordinates.length) : 0;
          result.face.coordinates = incrementalResult.face.coordinates ? incrementalResult.face.coordinates.slice(overlapSize) : [];
          result.face.confidence = incrementalResult.face.confidence ? incrementalResult.face.confidence.slice(overlapSize) : [];
          break;
        case 'aggregated':
          result.face.coordinates = faces.coordinates.slice(-this.bufferSizeAgg);
          result.face.confidence = faces.confidence.slice(-this.bufferSizeAgg);
          break;
        case 'complete':
          result.face.coordinates = faces.coordinates;
          result.face.confidence = faces.confidence;
          break;
      }
      result.face.note = "Face detection coordinates for this face, along with live confidence levels.";
    }
    
    if (waveforms) {
      // PPG
      const averagedPpgData = waveforms.ppgData.sum.map((val, i) => val / waveforms.ppgData.count[i]);
      const averagedPpgConf = waveforms.ppgConf.sum.map((val, i) => val / waveforms.ppgConf.count[i]);
      switch (waveformDataMode) {
        case 'incremental':
          const overlapSize = incrementalResult.vital_signs.ppg_waveform.data
            ? Math.min(this.methodConfig.windowOverlap, incrementalResult.vital_signs.ppg_waveform.data.length)
            : 0;
          result.vital_signs.ppg_waveform = {
            data: incrementalResult.vital_signs.ppg_waveform.data
              ? incrementalResult.vital_signs.ppg_waveform.data.slice(overlapSize)
              : [],
            confidence: incrementalResult.vital_signs.ppg_waveform.confidence
              ? incrementalResult.vital_signs.ppg_waveform.confidence.slice(overlapSize)
              : [],
            unit: "unitless",
            note: waveformNotes.ppg
          };
          break;
        case 'aggregated':
          result.vital_signs.ppg_waveform = {
            data: averagedPpgData.slice(-this.bufferSizeAgg),
            confidence: averagedPpgConf.slice(-this.bufferSizeAgg),
            unit: "unitless",
            note: waveformNotes.ppg
          };
          break;
        case 'complete':
          result.vital_signs.ppg_waveform = {
            data: averagedPpgData,
            confidence: averagedPpgConf,
            unit: "unitless",
            note: waveformNotes.ppg
          };
          break;
      }
      if (waveforms.ppgData.sum.length >= this.minBufferSizePpg) {
        const fps = this.getCurrentFps(sourceId, this.bufferSizePpg);
        if (fps) {
          result.vital_signs.heart_rate = {
            value: this.estimateHeartRate(averagedPpgData.slice(-this.bufferSizePpg), fps),
            confidence: averagedPpgConf.slice(-this.bufferSizePpg).reduce((a, b) => a + b, 0) / this.bufferSizePpg, // Mean confidence
            unit: "bpm",
            note: "Estimate of the heart rate, derived from ppg_waveform.",
          };
        }
      }

      // RESP
      const averagedRespData = waveforms.respData.sum.map((val, i) => val / waveforms.respData.count[i]);
      const averagedRespConf = waveforms.respConf.sum.map((val, i) => val / waveforms.respConf.count[i]);
      switch (waveformDataMode) {
        case 'incremental':
          const overlapSize = incrementalResult.vital_signs.respiratory_waveform.data
            ? Math.min(this.methodConfig.windowOverlap, incrementalResult.vital_signs.respiratory_waveform.data.length)
            : 0;
          result.vital_signs.respiratory_waveform = {
            data: incrementalResult.vital_signs.respiratory_waveform.data
              ? incrementalResult.vital_signs.respiratory_waveform.data.slice(overlapSize)
              : [],
            confidence: incrementalResult.vital_signs.respiratory_waveform.confidence
              ? incrementalResult.vital_signs.respiratory_waveform.confidence.slice(overlapSize)
              : [],
            unit: "unitless",
            note: waveformNotes.resp
          };
          break;
        case 'aggregated':
          result.vital_signs.respiratory_waveform = {
            data: averagedRespData.slice(-this.bufferSizeAgg),
            confidence: averagedRespConf.slice(-this.bufferSizeAgg),
            unit: "unitless",
            note: waveformNotes.resp
          };
          break;
        case 'complete':
          result.vital_signs.respiratory_waveform = {
            data: averagedRespData,
            confidence: averagedRespConf,
            unit: "unitless",
            note: waveformNotes.resp
          };
          break;
      }
      if (waveforms.respData.sum.length >= this.minBufferSizeResp) {
        const fps = this.getCurrentFps(sourceId, this.bufferSizeResp);
        if (fps) {
          result.vital_signs.respiratory_rate = {
            value: this.estimateRespiratoryRate(averagedRespData.slice(-this.bufferSizeResp), fps),
            confidence: averagedRespConf.slice(-this.bufferSizeResp).reduce((a, b) => a + b, 0) / this.bufferSizeResp, // Mean confidence
            unit: "bpm",
            note: "Estimate of the respiratory rate, derived from respiratory_waveform.",
          };
        }
      }
    }

    const fps = this.getCurrentFps(sourceId, this.bufferSizeAgg);
    if (fps) {
      result.fps = fps;
    }

    if (estFps) {
      result.estFps = estFps;  
    }

    if (message) {
      result.message = message;
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
