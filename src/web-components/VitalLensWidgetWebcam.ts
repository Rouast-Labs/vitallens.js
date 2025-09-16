import { VitalLensWidgetAdvanced } from './VitalLensWidgetAdvanced';

class VitalLensWidgetWebcam extends VitalLensWidgetAdvanced {
  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    // Remove the tabs container for webcam-only widget.
    const navbar = this.shadowRoot!.querySelector('#tabs-container');
    if (navbar) {
      navbar.remove();
    }
    // Force webcam mode.
    this.switchMode('webcam');
  }
}

customElements.define('vitallens-webcam-widget', VitalLensWidgetWebcam);
export default VitalLensWidgetWebcam;
