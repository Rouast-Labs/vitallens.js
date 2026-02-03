# Web Components

`vitallens.js` includes a suite of pre-built Custom Elements. These allow you to drop fully functional vitals scanning UIs into your application with a single HTML tag.

## Setup

Ensure you have imported the browser bundle:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/vitallens/dist/vitallens.browser.js"></script>
```

---

## `<vitallens-vitals-scan>`

<div align="center">
  <img src="https://raw.githubusercontent.com/Rouast-Labs/vitallens.js/main/assets/vitals-scan.png" alt="vitallens.js vitals-scan demo" width="266">
</div>

A self-contained wizard that guides the user through a 30-second measurement process. It handles face positioning, lighting checks, and displays the final results.

**Best for:** Health check-ins, onboarding flows.

```html
<vitallens-vitals-scan 
    api-key="YOUR_KEY" 
    default-mode="standard">
</vitallens-vitals-scan>
```

**Attributes:**

| Attribute | Description |
| :--- | :--- |
| `api-key` | Your VitalLens API Key. |
| `proxy-url` | URL to your backend proxy (Alternative to `api-key`). |
| `default-mode` | `"standard"` (30fps) or `"eco"` (15fps). |

---

## `<vitallens-vitals-monitor>`

<div align="center">
  <img src="https://raw.githubusercontent.com/Rouast-Labs/vitallens.js/main/assets/vitals-monitor.png" alt="vitallens.js vitals-monitor screenshot" width="320">
</div>

A simple continuous monitoring widget. It displays current Heart Rate, Respiratory Rate, and HRV values in real-time.

**Best for:** Dashboards, fitness applications.

```html
<vitallens-vitals-monitor 
    api-key="YOUR_KEY">
</vitallens-vitals-monitor>
```

**Attributes:**

| Attribute | Description |
| :--- | :--- |
| `api-key` | Your VitalLens API Key. |
| `proxy-url` | URL to your backend proxy (Alternative to `api-key`). |
| `default-mode` | `"standard"` (30fps) or `"eco"` (15fps). |

---

## `<vitallens-widget>`

<div align="center">
  <img src="https://raw.githubusercontent.com/Rouast-Labs/vitallens.js/main/assets/vitallens-widget.png" alt="vitallens.js widget screenshot" width="600">
</div>

The "Unified" widget. It provides a robust developer interface for switching between **Webcam** and **File** modes, selecting algorithms (VitalLens vs POS/G), and visualizing raw waveforms (PPG/Respiratory) on a chart.

**Best for:** Developer tools, data analysis, debugging.

```html
<vitallens-widget 
    api-key="YOUR_KEY">
</vitallens-widget>
```

**Attributes:**

| Attribute | Description |
| --- | --- |
| `api-key` | Your VitalLens API Key. |
| `proxy-url` | URL to your backend proxy (Alternative to `api-key`). |
