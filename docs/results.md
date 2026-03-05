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
  "vitals": {
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
    ...
  },
  "waveforms": {
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

| Vital Sign | Dictionary | Type | Based on / Contains | Returned if |
| --- | --- | --- | --- | --- |
| **PPG Waveform** | `waveforms` | Array | Depends on `waveformMode` | Always if face present |
| **Heart Rate** | `vitals` | Scalar | Up to last 10 seconds | Face present for at least 5 seconds |
| **Respiratory Waveform** | `waveforms` | Array | Depends on `waveformMode` | Face present using `vitallens` |
| **Respiratory Rate** | `vitals` | Scalar | Up to last 30 seconds | Face present for at least 10 seconds using `vitallens` |
| **HRV (SDNN)** | `vitals` | Scalar | Up to last 60 seconds | Face present for at least 20 seconds using `vitallens` |
| **HRV (RMSSD)** | `vitals` | Scalar | Up to last 60 seconds | Face present for at least 20 seconds using `vitallens` |
| **HRV (LF/HF)** | `vitals` | Scalar | Up to last 60 seconds | Face present for at least 55 seconds using `vitallens` |

> **Note:** HRV vitals are only available on `vitallens` version 2.0 or greater.

### 2. When Analyzing a Video File

In file mode, `VitalLens` returns **one** aggregate estimation result for the entire file. The data availability follows the exact same minimum-duration rules as streaming mode, but applies them to the total length of the video file.
