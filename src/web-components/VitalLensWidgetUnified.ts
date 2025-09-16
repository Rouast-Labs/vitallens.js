import { VitalLensWidgetAdvanced } from './VitalLensWidgetAdvanced';

class VitalLensWidgetUnified extends VitalLensWidgetAdvanced {
  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    // Default to webcam mode for the unified widget
    this.startMode('webcam', true, false).catch((err) =>
      console.error('Failed to start webcam mode:', err)
    );
  }
}

customElements.define('vitallens-widget', VitalLensWidgetUnified);
export default VitalLensWidgetUnified;
