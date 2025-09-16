import { VitalLensWidgetAdvanced } from './VitalLensWidgetAdvanced';

class VitalLensWidgetFile extends VitalLensWidgetAdvanced {
  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    // Remove the tabs container for file-only widget.
    const navbar = this.shadowRoot!.querySelector('#tabs-container');
    if (navbar) {
      navbar.remove();
    }
    // Force file mode.
    this.switchMode('file');
  }
}

customElements.define('vitallens-file-widget', VitalLensWidgetFile);
export default VitalLensWidgetFile;
