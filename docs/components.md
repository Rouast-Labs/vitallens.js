# Web Components

`vitallens.js` includes a suite of pre-built Custom Elements. These allow you to drop fully functional vitals scanning UIs into your application with a single HTML tag.

## Setup

Ensure you have imported the browser bundle:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/vitallens/dist/vitallens.browser.js"></script>
```

All components share the same core attributes for authentication:

| Attribute | Description |
| --- | --- |
| `api-key` | Your VitalLens API Key. |
| `proxy-url` | URL to your backend proxy (Alternative to `api-key` for production security). |

---

## `<vitallens-scan>`

<div align="center">
  <img src="https://raw.githubusercontent.com/Rouast-Labs/vitallens.js/main/assets/vitals-scan.png" alt="vitallens.js vitals-scan demo" width="266">
</div>

A self-contained wizard that guides the user through a fixed 30-second measurement process using their webcam. It handles face positioning, lighting checks, progress tracking, and displays the final aggregated results.

**Best for:** Health check-ins, onboarding flows, guided measurements.

```html
<vitallens-scan api-key="YOUR_KEY"></vitallens-scan>
```

---

## `<vitallens-monitor>`

<!-- TODO: New screenshot -->

<div align="center">
  <img src="https://raw.githubusercontent.com/Rouast-Labs/vitallens.js/main/assets/vitals-monitor.png" alt="vitallens.js vitals-monitor screenshot" width="320">
</div>

A continuous monitoring widget. It uses the webcam to display Heart Rate, Respiratory Rate, HRV values, and real-time waveforms on an ongoing basis. It automatically handles transient issues like face loss or poor lighting by instructing the user to adjust.

**Best for:** Dashboards, wellness training, continuous tracking.

```html
<vitallens-monitor api-key="YOUR_KEY"></vitallens-monitor>
```

---

## `<vitallens-file>`

<div align="center">
<img src="https://raw.githubusercontent.com/Rouast-Labs/vitallens.js/main/assets/vitals-file.png" alt="vitallens-file screenshot" width="320">
</div>

A file processing interface. It presents a simple start screen to prompt the user for a video file, handles the upload and processing state with a loading indicator, and displays the final extracted vitals and waveforms.

**Best for:** Asynchronous analysis, post-processing recorded videos, clinical reviews.

```html
<vitallens-file api-key="YOUR_KEY"></vitallens-file>
```

---

## `<vitallens-widget>`

<!-- TODO: Update screenshot -->

<div align="center">
  <img src="https://raw.githubusercontent.com/Rouast-Labs/vitallens.js/main/assets/vitallens-widget.png" alt="vitallens.js widget screenshot" width="600">
</div>

The advanced "Unified" widget. It provides a robust developer interface for switching between **Webcam** and **File** modes, selecting specific inference algorithms (VitalLens vs traditional rPPG methods like POS/G), and visualizing the raw data streams in real-time. It also includes an option to export the data as JSON.

**Best for:** Developer tools, data analysis, debugging, and testing configurations.

```html
<vitallens-widget api-key="YOUR_KEY"></vitallens-widget>
```