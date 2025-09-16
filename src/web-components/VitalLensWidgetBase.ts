import { VitalLens } from '../core/VitalLens.browser';
import { VitalLensOptions, VitalLensResult, Vital } from '../types';

// TODO: Fix anything we have broken and modernise

export abstract class VitalLensWidgetBase extends HTMLElement {
  protected vitalLensInstance?: VitalLens;
  protected apiKey: string | null = null;
  protected proxyUrl: string | null = null;
  protected latestResult: VitalLensResult | null = null;
  protected isProcessingFlag = false;
  protected supportedVitals: Vital[] = [];

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    // Redirect console.error to show in a UI popup
    const originalConsoleError = console.error.bind(console);
    console.error = (...args: unknown[]) => {
      originalConsoleError(...args);
      this.showError(args.join(' '));
    };
  }

  // Abstract methods to be implemented by subclasses
  protected abstract getElements(): void;
  protected abstract updateUI(result: VitalLensResult): void;
  protected abstract resetUI(): void;

  connectedCallback(): void {
    // This will be called by subclasses after they load their HTML
    if (this.shadowRoot!.innerHTML) {
      this.getElements();
      this.apiKey = this.getAttribute('api-key');
      this.proxyUrl = this.getAttribute('proxy-url');
    }
  }

  disconnectedCallback(): void {
    this.destroy();
  }

  protected async initVitalLensInstance(
    options: Partial<VitalLensOptions> = {}
  ): Promise<void> {
    if (this.vitalLensInstance) {
      await this.vitalLensInstance.close();
    }

    const vitalLensOptions: VitalLensOptions = {
      method: 'vitallens',
      apiKey: this.apiKey ?? undefined,
      proxyUrl: this.proxyUrl ?? undefined,
      ...options,
    };

    try {
      this.vitalLensInstance = new VitalLens(vitalLensOptions);
      this.vitalLensInstance.addEventListener('vitals', (result) =>
        this.handleVitalLensResults(result as VitalLensResult)
      );

      // After a brief moment for initialization, check for supported vitals
      setTimeout(() => {
        if (this.vitalLensInstance) {
          this.supportedVitals = this.vitalLensInstance.getSupportedVitals();
          this.updateHRVDisplay();
        }
      }, 500);
    } catch (e) {
      console.error(e);
      this.showError((e as Error).message);
    }
  }

  private handleVitalLensResults(result: VitalLensResult): void {
    this.latestResult = result;
    this.updateUI(result);
    // Re-check vitals in case of dynamic model changes
    if (this.vitalLensInstance) {
      this.supportedVitals = this.vitalLensInstance.getSupportedVitals();
      this.updateHRVDisplay();
    }
  }

  protected updateHRVDisplay(): void {
    const hrvContainer = this.shadowRoot?.querySelector(
      '#hrv-container'
    ) as HTMLElement | null;
    if (!hrvContainer || !this.supportedVitals) return;
    const hasHrv = this.supportedVitals.some((v) => v.startsWith('hrv_'));
    hrvContainer.style.display = hasHrv ? 'flex' : 'none';
  }

  protected showError(message: string): void {
    const errorPopup = this.shadowRoot?.querySelector(
      '#errorPopup'
    ) as HTMLElement | null;
    if (errorPopup) {
      errorPopup.textContent = message;
      errorPopup.style.display = 'block';
      setTimeout(() => {
        errorPopup.style.display = 'none';
      }, 10000);
    }
  }

  public destroy(): void {
    if (this.vitalLensInstance) {
      this.vitalLensInstance
        .close()
        .catch((e) => console.error('Error closing VitalLens instance:', e));
    }
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = '';
    }
  }
}
