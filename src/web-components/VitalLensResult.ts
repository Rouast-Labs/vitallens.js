import template from './result.html';
import logoUrl from '../../assets/logo.svg';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
} from 'chart.js';
import { VitalMetadataCache } from '../utils/VitalMetadataCache';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale
);

export interface ResolvedVital {
  id: string;
  title: string;
  value: number | null;
  unit: string;
  format: string;
  confidence: number | null;
  emoji: string;
}

export class VitalLensResult extends HTMLElement {
  private showDetails = false;

  private ppgChart: Chart | null = null;
  private respChart: Chart | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot!.innerHTML = template;
  }

  public destroyCharts(): void {
    if (this.ppgChart) {
      this.ppgChart.destroy();
      this.ppgChart = null;
    }
    if (this.respChart) {
      this.respChart.destroy();
      this.respChart = null;
    }
  }

  connectedCallback() {
    this.shadowRoot!.querySelector<HTMLImageElement>('#logo')!.src = logoUrl;
    this.shadowRoot!.querySelector('#titleEl')!.textContent =
      this.getAttribute('title-text') || 'Scan Complete';

    this.shadowRoot!.querySelector('#doneBtn')!.addEventListener(
      'click',
      () => {
        this.dispatchEvent(new CustomEvent('done'));
      }
    );

    this.shadowRoot!.querySelector('#detailsBtn')!.addEventListener(
      'click',
      () => {
        this.showDetails = !this.showDetails;
        this.shadowRoot!.querySelector('#wrapper')!.classList.toggle(
          'show-details',
          this.showDetails
        );
        this.shadowRoot!.querySelector('#detailsBtn')!.textContent = this
          .showDetails
          ? 'Hide Details'
          : 'View Details';
      }
    );
  }

  // Expose a setter to pass complex data into the component
  // Replace the resultData setter
  public set resultData(data: {
    primaryVitals: ResolvedVital[];
    secondaryVitals: ResolvedVital[];
    stats: { duration: number; sampleCount: number; avgFaceConf: number };
    ppgWaveform?: number[];
    respWaveform?: number[];
  }) {
    this.destroyCharts();

    this.renderGrid('#primaryGrid', data.primaryVitals);
    this.renderGrid('#secondaryGrid', data.secondaryVitals);

    const statsEl = this.shadowRoot!.querySelector('#statsEl')!;
    statsEl.innerHTML = `
      <div style="margin-bottom: 4px;">Total Usage: <span style="color: #fff;">${data.stats.duration.toFixed(1)}s (${data.stats.sampleCount}f)</span></div>
      <div>Avg Face Confidence: <span style="color: #fff;">${(data.stats.avgFaceConf * 100).toFixed(0)}%</span></div>
    `;

    if (data.ppgWaveform && data.ppgWaveform.length > 0) {
      const meta = VitalMetadataCache.getMeta('ppg_waveform');
      this.ppgChart = this.renderStaticChart(
        '#ppgBox',
        '#ppgCanvas',
        data.ppgWaveform,
        meta?.color || '#E62100'
      );
    }
    if (data.respWaveform && data.respWaveform.length > 0) {
      const meta = VitalMetadataCache.getMeta('respiratory_waveform');
      this.respChart = this.renderStaticChart(
        '#respBox',
        '#respCanvas',
        data.respWaveform,
        meta?.color || '#00A3FC'
      );
    }
  }

  private renderGrid(selector: string, vitals: ResolvedVital[]) {
    const grid = this.shadowRoot!.querySelector(selector)!;
    grid.innerHTML = '';
    vitals.forEach((vital) => {
      // Determine the format based on the config string (e.g., '%.0f' vs '%.2f')
      let valStr = '--';
      if (vital.value !== null) {
        const decimals = vital.format.includes('.2') ? 2 : 0;
        valStr = vital.value.toFixed(decimals);
      }

      const confStr =
        vital.confidence !== null
          ? `${(vital.confidence * 100).toFixed(0)}%`
          : '--';

      grid.innerHTML += `
        <div class="vital-tile">
          <div class="vital-title">${vital.emoji} ${vital.title}</div>
          <div class="vital-value-row">
            <span class="vital-val">${valStr}</span>
            <span class="vital-unit">${vital.unit}</span>
          </div>
          <div class="vital-conf">Conf: ${confStr}</div>
        </div>
      `;
    });
  }

  private renderStaticChart(
    boxSelector: string,
    canvasSelector: string,
    data: number[],
    color: string
  ): Chart {
    const colorStr = color.startsWith('#') ? color : `rgba(${color}, 1)`;
    const box = this.shadowRoot!.querySelector<HTMLElement>(boxSelector)!;
    const canvas =
      this.shadowRoot!.querySelector<HTMLCanvasElement>(canvasSelector)!;
    box.style.display = 'block';

    return new Chart(canvas.getContext('2d')!, {
      type: 'line',
      data: {
        labels: data.map((_, i) => i),
        datasets: [
          {
            data,
            borderColor: colorStr,
            borderWidth: 2,
            pointRadius: 0,
            tension: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        animation: false,
        scales: { x: { display: false }, y: { display: false } },
      },
    });
  }
}
customElements.define('vitallens-result', VitalLensResult);
