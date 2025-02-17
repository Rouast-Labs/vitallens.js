import { VitalLensWidgetBase } from './VitalLensWidgetBase';

class VitalLensWidgetWebcam extends VitalLensWidgetBase {
  constructor() {
    super();
  }
  connectedCallback() {
    this.getElements();
    // Remove the tabs container for webcam-only widget.
    const navbar = this.shadowRoot!.querySelector('#tabs-container');
    if (navbar) {
      navbar.remove();
    }
    this.apiKey = this.getAttribute('api-key') || '';
    this.proxyUrl = this.getAttribute('proxy-url') || null;
    this.bindEvents();
    this.charts.ppgChart = this.createChart(
      'ppgChart',
      'PPG Waveform',
      '230,34,0'
    );
    this.charts.respChart = this.createChart(
      'respChart',
      'Respiratory Waveform',
      '0,123,255'
    );
    // Force webcam mode.
    this.switchMode('webcam');
  }
}

customElements.define('vitallens-webcam-widget', VitalLensWidgetWebcam);
export default VitalLensWidgetWebcam;
