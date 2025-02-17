import { VitalLensWidgetBase } from './VitalLensWidgetBase';

class VitalLensWidgetFile extends VitalLensWidgetBase {
  constructor() {
    super();
  }
  connectedCallback() {
    this.getElements();
    // Remove the tabs container for file-only widget.
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
    // Force file mode.
    this.switchMode('file');
  }
}

customElements.define('vitallens-file-widget', VitalLensWidgetFile);
export default VitalLensWidgetFile;
