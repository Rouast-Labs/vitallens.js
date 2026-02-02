import { MethodConfig, VitalLensOptions, VitalLensResult } from '../types/core';
import { IVitalsEstimateManager } from '../types/IVitalsEstimateManager';
import { VITAL_REGISTRY } from '../config/vitalRegistry';
import { AGG_WINDOW_SIZE } from '../config/constants';

interface BufferData {
  sum: number[];
  count: number[];
}

export class VitalsEstimateManager implements IVitalsEstimateManager {
  private buffers: Map<
    string,
    Map<string, { data: BufferData; conf: BufferData }>
  > = new Map();
  private notes: Map<string, Map<string, string>> = new Map();
  private timestamps: Map<string, number[]> = new Map();
  private faces: Map<
    string,
    { coordinates: [number, number, number, number][]; confidence: number[] }
  > = new Map();
  private faceNote: Map<string, string> = new Map();
  private message: Map<string, string> = new Map();
  private lastEstimateTimestamps: Map<string, number> = new Map();

  /**
   * Initializes the manager with the provided method configuration.
   * @param getConfig - A function that returns the config.
   * @param options - The options.
   * @param postprocessFn - The function for signal postprocesing.
   */
  constructor(
    private getConfig: () => MethodConfig,
    private options: VitalLensOptions,
    private postprocessFn: (
      signalType: string,
      data: number[],
      fps: number,
      light: boolean
    ) => number[]
  ) {}

  private get methodConfig(): MethodConfig {
    return this.getConfig();
  }

  private get fpsTarget(): number {
    return this.options.overrideFpsTarget ?? this.methodConfig.fpsTarget;
  }

  /**
   * Helper to initialize buffers for a source/vital pair if they don't exist.
   */
  private ensureBuffer(sourceId: string, vitalName: string) {
    if (!this.buffers.has(sourceId)) {
      this.buffers.set(sourceId, new Map());
    }
    const sourceBuffers = this.buffers.get(sourceId)!;
    if (!sourceBuffers.has(vitalName)) {
      sourceBuffers.set(vitalName, {
        data: { sum: [], count: [] },
        conf: { sum: [], count: [] },
      });
    }
    return sourceBuffers.get(vitalName)!;
  }

  private setNote(sourceId: string, vitalName: string, note: string) {
    if (!this.notes.has(sourceId)) this.notes.set(sourceId, new Map());
    this.notes.get(sourceId)!.set(vitalName, note);
  }

  /**
   * Generic update function for any signal.
   * Handles overlap and merging logic for infinite streams.
   */
  private updateSignalBuffer(
    sourceId: string,
    vitalName: string,
    incrementalData: number[],
    incrementalConf: number[],
    waveformMode: string,
    overlap: number
  ) {
    const buffer = this.ensureBuffer(sourceId, vitalName);

    // Determine the max window size needed for this vital.
    let maxWindowSize = this.fpsTarget * AGG_WINDOW_SIZE;

    for (const meta of Object.values(VITAL_REGISTRY)) {
      if (meta.derivation?.sourceSignal === vitalName) {
        const win = meta.derivation.window;
        const requiredSamples =
          this.fpsTarget * Math.max(win.size, win.required);
        if (requiredSamples > maxWindowSize) maxWindowSize = requiredSamples;
      }
    }

    const meta = VITAL_REGISTRY[vitalName];
    if (meta?.processing?.minWindow) {
      const requiredSamples = this.fpsTarget * meta.processing.minWindow;
      if (requiredSamples > maxWindowSize) maxWindowSize = requiredSamples;
    }

    const updatedData = this.getUpdatedSumCount(
      buffer.data,
      incrementalData,
      waveformMode,
      maxWindowSize,
      overlap
    );
    const updatedConf = this.getUpdatedSumCount(
      buffer.conf,
      incrementalConf,
      waveformMode,
      maxWindowSize,
      overlap
    );

    buffer.data = updatedData;
    buffer.conf = updatedConf;
  }

  /**
   * Returns an array of buffered results, one for each time step in the incremental result.
   * Used primarily in streaming to "smooth out" delivery if processing is slower than realtime.
   */
  async produceBufferedResults(
    incrementalResult: VitalLensResult,
    sourceId: string,
    defaultWaveformMode: string
  ): Promise<Array<VitalLensResult> | null> {
    const currentTimestamps: number[] = this.timestamps.get(sourceId) ?? [];
    const newTimestamps: number[] = incrementalResult.time;
    const waveformMode = this.options.waveformMode || defaultWaveformMode;

    // Determine overlap to find new frames
    const overlap = Math.min(
      currentTimestamps.length,
      Math.max(
        0,
        newTimestamps.findIndex((ts) => !currentTimestamps.includes(ts))
      )
    );

    const results: VitalLensResult[] = [];

    for (let i = overlap; i < newTimestamps.length; i++) {
      const singleResult: VitalLensResult = {
        face: {
          coordinates: incrementalResult.face?.coordinates?.[i]
            ? [incrementalResult.face.coordinates[i]]
            : [],
          confidence:
            incrementalResult.face?.confidence?.[i] !== undefined
              ? [incrementalResult.face.confidence[i]]
              : [],
        },
        vital_signs: {},
        time: [newTimestamps[i]],
        message: incrementalResult.message,
        display_time: newTimestamps[i] + (this.methodConfig.bufferOffset || 0),
      };

      // Dynamically copy frame-specific data for all available vitals in the API response
      if (incrementalResult.vital_signs) {
        for (const [key, value] of Object.entries(
          incrementalResult.vital_signs
        )) {
          if (
            value &&
            Array.isArray(value.data) &&
            value.data[i] !== undefined &&
            Array.isArray(value.confidence) &&
            value.confidence[i] !== undefined
          ) {
            (singleResult.vital_signs as any)[key] = {
              data: [value.data[i]],
              confidence: [value.confidence[i] as number],
              unit: value.unit,
              note: value.note,
            };
          }
        }
      }

      const processedResult = await this.processIncrementalResult(
        singleResult,
        sourceId,
        waveformMode,
        true,
        true
      );

      if (processedResult) {
        results.push(processedResult);
      }
    }

    return results;
  }

  /**
   * Processes an incremental result and aggregates it into the buffer.
   */
  async processIncrementalResult(
    incrementalResult: VitalLensResult,
    sourceId: string,
    defaultWaveformMode: string,
    light: boolean = true,
    returnResult: boolean = true
  ): Promise<VitalLensResult | null> {
    const currentTime = performance.now();
    const waveformMode = this.options.waveformMode || defaultWaveformMode;

    // Determine overlap
    const currentTimestamps: number[] = this.timestamps.get(sourceId) || [];
    const newTimestamps: number[] = incrementalResult.time;
    const overlap = Math.min(
      currentTimestamps.length,
      Math.max(
        0,
        newTimestamps.findIndex((ts) => !currentTimestamps.includes(ts))
      )
    );

    // Update timestamps
    this.updateTimestamps(sourceId, newTimestamps, waveformMode, overlap);

    // Update faces
    if (incrementalResult.face) {
      this.updateFaces(sourceId, incrementalResult.face, waveformMode, overlap);
    }

    // Update message
    if (incrementalResult.message) {
      this.message.set(sourceId, incrementalResult.message);
    }

    // Calculate Estimation FPS
    const lastEstimateTimestamp = this.lastEstimateTimestamps.get(sourceId);
    const estFps = lastEstimateTimestamp
      ? 1000 / (currentTime - lastEstimateTimestamp)
      : undefined;
    this.lastEstimateTimestamps.set(sourceId, currentTime);

    // Dynamically update buffers for all provided vitals
    if (incrementalResult.vital_signs) {
      for (const [key, value] of Object.entries(
        incrementalResult.vital_signs
      )) {
        if (Array.isArray(value?.data) && Array.isArray(value?.confidence)) {
          this.updateSignalBuffer(
            sourceId,
            key,
            value!.data as number[],
            value!.confidence as number[],
            waveformMode,
            overlap
          );
          // Save the note if present
          if (value!.note) this.setNote(sourceId, key, value!.note);
        }
      }
    }

    if (returnResult) {
      return await this.assembleResult(
        sourceId,
        waveformMode,
        light,
        overlap,
        incrementalResult,
        estFps
      );
    } else {
      return null;
    }
  }

  private async assembleResult(
    sourceId: string,
    waveformMode: string,
    light: boolean,
    overlap: number = 0,
    incrementalResult?: VitalLensResult,
    estFps?: number
  ): Promise<VitalLensResult> {
    const result: VitalLensResult = {
      face: {},
      vital_signs: {},
      time: [],
      message: this.message.get(sourceId) || '',
    };

    // 1. Assemble timestamps & faces
    const storedTimestamps = this.timestamps.get(sourceId) || [];
    const storedFaces = this.faces.get(sourceId);
    const incrementSize =
      incrementalResult?.time && overlap
        ? incrementalResult.time.length - overlap
        : 0;

    // Time
    if (storedTimestamps.length > 0) {
      switch (waveformMode) {
        case 'incremental':
          result.time = incrementalResult?.time
            ? incrementalResult.time.slice(-incrementSize)
            : [];
          break;
        case 'windowed':
          result.time = storedTimestamps.slice(-this.bufferSizeAgg);
          break;
        case 'complete':
          result.time = storedTimestamps;
          break;
      }
    }

    // Face
    if (storedFaces) {
      switch (waveformMode) {
        case 'incremental':
          result.face.coordinates = incrementalResult?.face.coordinates
            ? incrementalResult.face.coordinates.slice(-incrementSize)
            : [];
          result.face.confidence = incrementalResult?.face.confidence
            ? incrementalResult.face.confidence.slice(-incrementSize)
            : [];
          break;
        case 'windowed':
          result.face.coordinates = storedFaces.coordinates.slice(
            -this.bufferSizeAgg
          );
          result.face.confidence = storedFaces.confidence.slice(
            -this.bufferSizeAgg
          );
          break;
        case 'complete':
          result.face.coordinates = storedFaces.coordinates;
          result.face.confidence = storedFaces.confidence;
          break;
      }
      result.face.note =
        'Face detection coordinates for this face, along with live confidence levels.';
    }

    // 2. Assemble vitals
    const sourceBuffers = this.buffers.get(sourceId);
    if (!sourceBuffers) return result;

    const currentFps =
      this.getCurrentFps(sourceId, this.fpsTarget * 10) || this.fpsTarget;

    // Customize order in which vitals are processed
    let supportedVitals = (this.methodConfig.supportedVitals || []) as string[];
    supportedVitals = [...supportedVitals].sort((a, b) => {
      const typeA = VITAL_REGISTRY[a]?.type;
      const typeB = VITAL_REGISTRY[b]?.type;
      if (typeA !== typeB) {
        return typeA === 'provided' ? -1 : 1;
      }
      if (typeA === 'derived') {
        const isRateA = a.includes('rate');
        const isRateB = b.includes('rate');
        if (isRateA && !isRateB) return -1;
        if (!isRateA && isRateB) return 1;
      }
      return 0;
    });

    for (const vitalName of supportedVitals) {
      const meta = VITAL_REGISTRY[vitalName];
      if (!meta) continue;

      // Case A: Provided vitals
      if (meta.type === 'provided') {
        const buffer = sourceBuffers.get(vitalName);
        if (buffer) {
          // Calculate average from accumulated sum/count
          const avgData = buffer.data.sum.map(
            (v, i) => v / buffer.data.count[i]
          );
          const avgConf = buffer.conf.sum.map(
            (v, i) => v / buffer.conf.count[i]
          );

          // Apply waveform mode slicing
          let sliceData: number[] = [];
          let sliceConf: number[] = [];

          switch (waveformMode) {
            case 'incremental':
              if (
                incrementalResult?.vital_signs &&
                (incrementalResult.vital_signs as any)[vitalName]
              ) {
                const incVital = (incrementalResult.vital_signs as any)[
                  vitalName
                ];
                sliceData = incVital.data.slice(-incrementSize);
                sliceConf = incVital.confidence.slice(-incrementSize);
              } else {
                sliceData = avgData.slice(-incrementSize);
                sliceConf = avgConf.slice(-incrementSize);
              }
              break;
            case 'windowed':
              sliceData = avgData.slice(-this.bufferSizeAgg);
              sliceConf = avgConf.slice(-this.bufferSizeAgg);
              break;
            case 'complete':
              sliceData = avgData;
              sliceConf = avgConf;
              break;
          }

          // Postprocessing
          if (sliceData.length > 0) {
            const procConfig = meta.processing;
            let shouldProcess = !!procConfig;

            if (shouldProcess) {
              const minSamples = (procConfig?.minWindow || 0) * currentFps;
              if (
                waveformMode === 'incremental' ||
                sliceData.length < minSamples
              ) {
                shouldProcess = false;
              }
            }

            if (shouldProcess) {
              sliceData = this.postprocessFn(
                vitalName,
                sliceData,
                currentFps,
                light
              );
            }

            (result.vital_signs as any)[vitalName] = {
              data: sliceData,
              confidence: sliceConf,
              unit: meta.unit,
              note:
                this.notes.get(sourceId)?.get(vitalName) || meta.displayName,
            };
          }
        }
      }

      // Case B: Derived vitals (Calculated locally)
      else if (meta.type === 'derived' && meta.derivation) {
        const deriv = meta.derivation;
        const sourceBuffer = sourceBuffers.get(deriv.sourceSignal);

        if (sourceBuffer) {
          const avgData = sourceBuffer.data.sum.map(
            (v, i) => v / sourceBuffer.data.count[i]
          );
          const avgConf = sourceBuffer.conf.sum.map(
            (v, i) => v / sourceBuffer.conf.count[i]
          );

          const minSamples = deriv.window.required * currentFps;

          if (avgData.length >= minSamples) {
            let calcData = avgData;
            let calcConf = avgConf;

            if (waveformMode !== 'complete') {
              const maxSamples = Math.floor(deriv.window.size * currentFps);
              calcData = avgData.slice(-maxSamples);
              calcConf = avgConf.slice(-maxSamples);
            }

            // Preprocess source signal before calculation
            calcData = this.postprocessFn(
              deriv.sourceSignal,
              calcData,
              currentFps,
              light
            );

            // Context for calculation
            const estimatedHeartRate = result.vital_signs['heart_rate']?.value;

            const calcResult = deriv.calcFunc(calcData, currentFps, {
              confidence: calcConf,
              timestamps: storedTimestamps.slice(-calcData.length),
              estimatedHeartRate:
                typeof estimatedHeartRate === 'number'
                  ? estimatedHeartRate
                  : undefined,
            });

            if (calcResult !== null) {
              let val: number;
              let confSource: number[];

              // Unpack the result
              if (typeof calcResult === 'object') {
                val = calcResult.value;
                confSource = calcResult.confidence;
              } else {
                val = calcResult;
                confSource = calcConf;
              }

              // Aggregate confidence
              let conf: number;
              if (confSource.length === 0) {
                conf = 0;
              } else {
                conf =
                  deriv.confidenceAggregation === 'min'
                    ? Math.min(...confSource)
                    : calcConf.reduce((a, b) => a + b, 0) / calcConf.length;
              }

              // Apply constraints
              const limits = deriv.constraints;
              let isValid = true;
              if (limits) {
                if (limits.min !== undefined && val < limits.min)
                  isValid = false;
                if (limits.max !== undefined && val > limits.max)
                  isValid = false;
              }

              // Assign Result
              if (isValid) {
                (result.vital_signs as any)[vitalName] = {
                  value: val,
                  unit: meta.unit,
                  confidence: conf,
                  note: `Estimate of the ${meta.displayName}`,
                };
              }
            }
          }
        }
      }
    }

    if (currentFps) result.fps = currentFps;
    if (estFps) result.est_fps = estFps;
    if (incrementalResult?.display_time)
      result.display_time = incrementalResult.display_time;

    return result;
  }

  /**
   * Updates sum and count arrays by handling overlap and trimming to a maximum buffer size.
   */
  private getUpdatedSumCount(
    currentBuffer: { sum: number[]; count: number[] },
    incremental: number[],
    waveformMode: string,
    maxBufferSize: number,
    overlap: number
  ): { sum: number[]; count: number[] } {
    const { sum: currentSum, count: currentCount } = currentBuffer;

    if (currentSum.length === 0 || currentCount.length === 0) {
      return {
        sum: [...incremental],
        count: Array(incremental.length).fill(1),
      };
    }

    let updatedSum;
    let updatedCount;

    if (overlap === 0) {
      updatedSum = [...currentSum, ...incremental];
      updatedCount = [...currentCount, ...Array(incremental.length).fill(1)];
    } else {
      const existingTailSum = currentSum.slice(-overlap);
      const incrementalHead = incremental.slice(0, overlap);

      const updatedTailSum = existingTailSum.map(
        (val, idx) => val + incrementalHead[idx]
      );
      const updatedTailCount = currentCount
        .slice(-overlap)
        .map((val) => val + 1);

      const nonOverlappingSum = incremental.slice(overlap);
      const nonOverlappingCount = Array(nonOverlappingSum.length).fill(1);

      updatedSum = [
        ...currentSum.slice(0, -overlap),
        ...updatedTailSum,
        ...nonOverlappingSum,
      ];

      updatedCount = [
        ...currentCount.slice(0, -overlap),
        ...updatedTailCount,
        ...nonOverlappingCount,
      ];
    }

    // Trim buffers
    if (waveformMode !== 'complete' && updatedSum.length > maxBufferSize) {
      updatedSum = updatedSum.slice(-maxBufferSize);
      updatedCount = updatedCount.slice(-maxBufferSize);
    }

    return { sum: updatedSum, count: updatedCount };
  }

  private updateTimestamps(
    sourceId: string,
    newTimestamps: number[],
    waveformMode: string,
    overlap: number
  ): void {
    const currentTimestamps = this.timestamps.get(sourceId) || [];
    const maxBufferSize = this.fpsTarget * 90;

    const nonOverlapping = newTimestamps.slice(overlap);
    let updated = [...currentTimestamps, ...nonOverlapping];

    if (waveformMode !== 'complete' && updated.length > maxBufferSize) {
      updated = updated.slice(-maxBufferSize);
    }
    this.timestamps.set(sourceId, updated);
  }

  private updateFaces(
    sourceId: string,
    newFaces: VitalLensResult['face'],
    waveformMode: string,
    overlap: number
  ): void {
    const currentFaces = this.faces.get(sourceId) || {
      coordinates: [],
      confidence: [],
    };

    // Helper to merge arrays
    const merge = (current: any[], newVals: any[]) => {
      const nonOverlapping = newVals.slice(overlap);
      let updated = [...current, ...nonOverlapping];
      const maxBufferSize = this.fpsTarget * 90;
      if (waveformMode !== 'complete' && updated.length > maxBufferSize) {
        updated = updated.slice(-maxBufferSize);
      }
      return updated;
    };

    if (newFaces.coordinates && newFaces.confidence) {
      this.faces.set(sourceId, {
        coordinates: merge(currentFaces.coordinates, newFaces.coordinates),
        confidence: merge(currentFaces.confidence, newFaces.confidence),
      });
    }
    if (newFaces.note) this.faceNote.set(sourceId, newFaces.note);
  }

  private getCurrentFps(sourceId: string, bufferSize: number): number | null {
    const timestamps = this.timestamps.get(sourceId)?.slice(-bufferSize);
    if (!timestamps || timestamps.length < 2) {
      return null;
    }
    const timeDiffs = timestamps.slice(1).map((t, i) => t - timestamps[i]);
    const avgTimeDiff =
      timeDiffs.reduce((acc, val) => acc + val, 0) / timeDiffs.length;
    return avgTimeDiff > 0 ? 1 / avgTimeDiff : null;
  }

  async getResult(sourceId: string): Promise<VitalLensResult> {
    return await this.assembleResult(sourceId, 'complete', false);
  }

  getEmptyResult(): VitalLensResult {
    return {
      face: {},
      vital_signs: {},
      time: [],
      message: 'Prediction is empty because no face was detected.',
    };
  }

  private get bufferSizeAgg(): number {
    return this.fpsTarget * AGG_WINDOW_SIZE;
  }

  reset(sourceId: string) {
    this.buffers.delete(sourceId);
    this.timestamps.delete(sourceId);
    this.faces.delete(sourceId);
    this.message.delete(sourceId);
    this.lastEstimateTimestamps.delete(sourceId);
    this.notes.delete(sourceId);
    this.faceNote.delete(sourceId);
  }

  resetAll() {
    this.buffers.clear();
    this.timestamps.clear();
    this.faces.clear();
    this.message.clear();
    this.lastEstimateTimestamps.clear();
    this.notes.clear();
    this.faceNote.clear();
  }
}
