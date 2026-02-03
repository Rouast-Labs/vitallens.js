# Understanding the Results

When you process video using `vitallens.js`, the results are returned as a structured object.

Unlike the `vitallens-python`, which handles multiple faces, `vitallens.js` is designed to process only a single face. You always receive a single result object per event or file.

## Result Structure

### JSON Schema

The result object follows the `VitalLensResult` interface. Below is an example of the JSON structure you will receive.

```json
{
  "face": {
    "coordinates": [[247, 52, 444, 332], ...],
    "confidence": [0.6115, 0.9207, 0.9183, ...],
    "note": "Face detection coordinates..."
  },
  "vital_signs": {
    "heart_rate": {
      "value": 60.21,
      "unit": "bpm",
      "confidence": 0.9205,
      "note": "Global estimate of Heart Rate..."
    },
    "respiratory_rate": {
      "value": 12.08,
      "unit": "bpm",
      "confidence": 0.9969,
      "note": "Global estimate of Respiratory Rate..."
    },
    "ppg_waveform": {
      "data": [0.12, 0.15, 0.18, ...],
      "confidence": [0.99, 0.99, ...],
      "unit": "unitless"
    },
    ...
  },
  "fps": 30.0,
  "message": "The provided values are estimates..."
}
```

## Data Availability

You might notice that not all keys (like `hrv_sdnn`) are present in every result. The availability of specific vital signs depends on the **processing mode** (Stream vs. File) and the **duration** of the data.

### 1. When Analyzing a Video Stream

In streaming mode, `VitalLens` returns estimation results continuously. Each result represents a window of the most recent data.

| Vital Sign | Key | Type | Based on / Contains | Returned if |
| --- | --- | --- | --- | --- |
| **PPG Waveform** | `ppg_waveform` | Continuous waveform | Depends on `waveformMode` | Always if face present |
| **Heart Rate** | `heart_rate` | Global value | Up to last 10 seconds | Face present for at least 5 seconds |
| **Respiratory Waveform** | `respiratory_waveform` | Continuous waveform | Depends on `waveformMode` | Face present using `vitallens` |
| **Respiratory Rate** | `respiratory_rate` | Global value | Up to last 30 seconds | Face present for at least 10 seconds using `vitallens` |
| **HRV (SDNN)** | `hrv_sdnn` | Global value | Up to last 60 seconds | Face present for at least 20 seconds using `vitallens` |
| **HRV (RMSSD)** | `hrv_rmssd` | Global value | Up to last 60 seconds | Face present for at least 20 seconds using `vitallens` |
| **HRV (LF/HF)** | `hrv_lfhf` | Global value | Up to last 60 seconds | Face present for at least 55 seconds using `vitallens` |

> **Note:** HRV vitals are only available on `vitallens` version 2.0 or greater.

### 2. When Analyzing a Video File

In file mode, `VitalLens` returns **one** aggregate estimation result for the entire file.

| Vital Sign | Key | Type | Based on / Contains | Returned if |
| --- | --- | --- | --- | --- |
| **PPG Waveform** | `ppg_waveform` | Continuous waveform | Depends on `waveformMode` | Always if face present |
| **Heart Rate** | `heart_rate` | Global value | Entire video | Face present for at least 5 seconds |
| **Respiratory Waveform** | `respiratory_waveform` | Continuous waveform | Depends on `waveformMode` | Face present using `vitallens` |
| **Respiratory Rate** | `respiratory_rate` | Global value | Entire video | Face present for at least 10 seconds using `vitallens` |
| **HRV (SDNN)** | `hrv_sdnn` | Global value | Entire video | Face present for at least 20 seconds using `vitallens` |
| **HRV (RMSSD)** | `hrv_rmssd` | Global value | Entire video | Face present for at least 20 seconds using `vitallens` |
| **HRV (LF/HF)** | `hrv_lfhf` | Global value | Entire video | Face present for at least 55 seconds using `vitallens` |

> **Note:** HRV vitals are only available on `vitallens` version 2.0 or greater.

<!-- 

```typescript
export interface VitalLensResult {
  face: {
    // Detected face coordinates for each frame, formatted as [x0, y0, x1, y1].
    coordinates: Array<[number, number, number, number]>;
    // Confidence values for the face per frame.
    confidence: number[];
    // An explanatory note regarding the face detection.
    note: string;
  };
  vital_signs: {
    // Estimated global heart rate.
    heart_rate: {
      // Estimated heart rate value.
      value: number;
      // Unit of the heart rate value.
      unit: string;
      // Overall confidence of the heart rate estimation.
      confidence: number;
      // An explanatory note regarding the estimation.
      note: string;
    };
    // Other vitals...
  };
  // A list of timestamps (one per processed frame).
  time: number[];
  // The frames per second (fps) of the input video.
  fps: number;
  // The effective fps used for inference.
  est_fps: number;
  // A message providing additional information about the estimation.
  message: string;
}
```










# Understanding Results

The structure of the results object is consistent across both the `VitalLens` class and the Web Components.

## Result Object Structure

The result is a JSON object containing the `vital_signs` dictionary and metadata about the `face`.

```json
{
  "face": {
    "coordinates": [[335, 60, 585, 460]], // [x, y, w, h]
    "confidence": [0.99],
    "note": "Face detection coordinates..."
  },
  "vital_signs": {
    "heart_rate": {
      "value": 72.5,
      "unit": "bpm",
      "confidence": 0.98,
      "note": "Global estimate..."
    },
    "respiratory_rate": {
      "value": 16.0,
      "unit": "bpm",
      "confidence": 0.95,
      "note": "Global estimate..."
    },
    "ppg_waveform": {
      "data": [0.12, 0.15, 0.18, ...],
      "confidence": [0.99, 0.99, ...],
      "unit": "unitless"
    }
  },
  "fps": 30.0,
  "message": "The provided values are estimates..."
}

```

## Confidence Scores

Every vital sign comes with a `confidence` score (0.0 to 1.0).

* **> 0.8**: High confidence. Result is reliable.
* **0.5 - 0.8**: Moderate confidence. Results may be noisy due to lighting or movement.
* **< 0.5**: Low confidence. The API likely did not detect a clean signal. **You should hide these values from the user.**

## Availability of Vitals

Not all vitals are available immediately.

| Vital | Required Duration | Notes |
| --- | --- | --- |
| **Heart Rate** | ~5-10s | Available quickly. |
| **Respiratory Rate** | ~10-15s | Requires upper body visibility. |
| **HRV (SDNN)** | ~20s | Requires `vitallens` method. |
| **HRV (LF/HF)** | ~60s | Requires long-term measurement. | -->
