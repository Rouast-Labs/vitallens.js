import { VitalLensWidgetBase } from './VitalLensWidgetBase';

class VitalLensWidgetUnified extends VitalLensWidgetBase {
  constructor() {
    super();
  }
  connectedCallback() {
    super.connectedCallback();
    // For unified widget, use the full template.
    this.getElements();
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
    this.switchMode('webcam');
  }
}

customElements.define('vitallens-widget', VitalLensWidgetUnified);
export default VitalLensWidgetUnified;
