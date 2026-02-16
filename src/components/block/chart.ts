import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';

const CHART_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .chart-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    padding: 16px;
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
    background: var(--livellm-bg-component, #ffffff);
  }
  .chart-title {
    font-weight: 600;
    font-size: 15px;
    margin-bottom: 16px;
    text-align: center;
  }
  .chart-svg { width: 100%; overflow: visible; }
  .bar { transition: opacity 0.2s; cursor: pointer; }
  .bar:hover { opacity: 0.8; }
  .chart-label {
    font-size: 11px;
    fill: var(--livellm-text-secondary, #6c757d);
    text-anchor: middle;
  }
  .chart-value {
    font-size: 11px;
    fill: var(--livellm-text, #1a1a1a);
    text-anchor: middle;
    font-weight: 600;
  }
  .axis-line { stroke: var(--livellm-border, #e0e0e0); stroke-width: 1; }
  .grid-line { stroke: var(--livellm-border, #e0e0e0); stroke-width: 0.5; opacity: 0.5; }
  .legend {
    display: flex;
    justify-content: center;
    gap: 16px;
    margin-top: 12px;
    flex-wrap: wrap;
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--livellm-text-secondary, #6c757d);
  }
  .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .pie-slice { cursor: pointer; transition: opacity 0.2s; }
  .pie-slice:hover { opacity: 0.8; }
`;

const DEFAULT_COLORS = ['#6c5ce7', '#00cec9', '#fdcb6e', '#ff6b6b', '#74b9ff', '#a29bfe', '#55efc4', '#fab1a0'];

interface Dataset {
  label: string;
  data: number[];
  color?: string;
}

export class LiveLLMChart extends LiveLLMComponent {
  render(): void {
    const chartType = this._props.type || 'bar';
    const title = this._props.title || '';
    const rawLabels = this._props.labels || this._props.categories || this._props.xAxis || [];
    const labels: string[] = Array.isArray(rawLabels) ? rawLabels.map((l: any) => String(l ?? '')) : [];
    const rawDatasets = this._props.datasets || this._props.series || this._props.data || [];
    const datasets: Dataset[] = Array.isArray(rawDatasets)
      ? rawDatasets.map((ds: any) => this.normalizeDataset(ds))
      : [];
    const legend = this._props.legend !== false;

    this.setStyles(CHART_STYLES);

    let chartHtml = '';
    switch (chartType) {
      case 'bar':
        chartHtml = this.renderBarChart(labels, datasets);
        break;
      case 'pie':
      case 'doughnut':
        chartHtml = this.renderPieChart(labels, datasets, chartType === 'doughnut');
        break;
      case 'line':
        chartHtml = this.renderLineChart(labels, datasets);
        break;
      default:
        chartHtml = this.renderBarChart(labels, datasets);
    }

    const legendHtml = legend && datasets.length > 0 ? this.renderLegend(datasets) : '';

    this.setContent(`
      <div class="chart-container">
        ${title ? `<div class="chart-title">${this.escapeHtml(title)}</div>` : ''}
        ${chartHtml}
        ${legendHtml}
      </div>
    `);

    this.bindChartEvents();
  }

  private renderBarChart(labels: string[], datasets: Dataset[]): string {
    if (!datasets.length || !labels.length) return '<p>No data</p>';

    const width = 400;
    const height = 200;
    const padding = { top: 20, right: 20, bottom: 40, left: 10 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const allValues = datasets.flatMap((d) => d.data);
    const maxVal = Math.max(...allValues, 1);

    const groupWidth = chartW / labels.length;
    const barWidth = (groupWidth * 0.7) / datasets.length;
    const groupPad = groupWidth * 0.15;

    let bars = '';
    let valueLabels = '';
    let xLabels = '';

    labels.forEach((label, i) => {
      const x = padding.left + i * groupWidth;

      datasets.forEach((ds, di) => {
        const val = ds.data[i] || 0;
        const barH = (val / maxVal) * chartH;
        const barX = x + groupPad + di * barWidth;
        const barY = padding.top + chartH - barH;
        const color = ds.color || DEFAULT_COLORS[di % DEFAULT_COLORS.length];

        bars += `<rect class="bar" x="${barX}" y="${barY}" width="${barWidth}" height="${barH}" fill="${color}" rx="2" data-index="${i}" data-dataset="${di}" data-value="${val}" data-label="${this.escapeAttr(label)}"/>`;
        valueLabels += `<text class="chart-value" x="${barX + barWidth / 2}" y="${barY - 4}">${this.formatNumber(val)}</text>`;
      });

      xLabels += `<text class="chart-label" x="${x + groupWidth / 2}" y="${height - 8}">${this.escapeHtml(this.truncate(label, 12))}</text>`;
    });

    // Grid lines
    let gridLines = '';
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH / 4) * i;
      gridLines += `<line class="grid-line" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}"/>`;
    }

    return `
      <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
        ${gridLines}
        <line class="axis-line" x1="${padding.left}" y1="${padding.top + chartH}" x2="${width - padding.right}" y2="${padding.top + chartH}"/>
        ${bars}
        ${valueLabels}
        ${xLabels}
      </svg>`;
  }

  private renderPieChart(labels: string[], datasets: Dataset[], doughnut: boolean): string {
    if (!datasets.length || !datasets[0].data.length) return '<p>No data</p>';

    const data = datasets[0].data;
    const total = data.reduce((s, v) => s + v, 0);
    if (total === 0) return '<p>No data</p>';

    const cx = 150;
    const cy = 100;
    const r = 80;
    const innerR = doughnut ? 45 : 0;

    let slices = '';
    let startAngle = -Math.PI / 2;

    data.forEach((val, i) => {
      const angle = (val / total) * 2 * Math.PI;
      const endAngle = startAngle + angle;
      const largeArc = angle > Math.PI ? 1 : 0;

      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);

      let d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
      if (innerR > 0) {
        const ix1 = cx + innerR * Math.cos(endAngle);
        const iy1 = cy + innerR * Math.sin(endAngle);
        const ix2 = cx + innerR * Math.cos(startAngle);
        const iy2 = cy + innerR * Math.sin(startAngle);
        d += ` L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2} Z`;
      } else {
        d += ` L ${cx} ${cy} Z`;
      }

      const color = DEFAULT_COLORS[i % DEFAULT_COLORS.length];
      const label = labels[i] || `Item ${i + 1}`;
      slices += `<path class="pie-slice" d="${d}" fill="${color}" data-index="${i}" data-value="${val}" data-label="${this.escapeAttr(label)}"/>`;

      startAngle = endAngle;
    });

    return `
      <svg class="chart-svg" viewBox="0 0 300 200" preserveAspectRatio="xMidYMid meet">
        ${slices}
      </svg>`;
  }

  private renderLineChart(labels: string[], datasets: Dataset[]): string {
    if (!datasets.length || !labels.length) return '<p>No data</p>';

    const width = 400;
    const height = 200;
    const padding = { top: 20, right: 20, bottom: 40, left: 10 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const allValues = datasets.flatMap((d) => d.data);
    const maxVal = Math.max(...allValues, 1);

    let lines = '';
    let dots = '';
    let xLabels = '';

    datasets.forEach((ds, di) => {
      const color = ds.color || DEFAULT_COLORS[di % DEFAULT_COLORS.length];
      const points: string[] = [];

      ds.data.forEach((val, i) => {
        const x = padding.left + (i / (labels.length - 1 || 1)) * chartW;
        const y = padding.top + chartH - (val / maxVal) * chartH;
        points.push(`${x},${y}`);
        dots += `<circle cx="${x}" cy="${y}" r="3" fill="${color}" data-index="${i}" data-dataset="${di}" data-value="${val}"/>`;
      });

      lines += `<polyline points="${points.join(' ')}" fill="none" stroke="${color}" stroke-width="2"/>`;
    });

    labels.forEach((label, i) => {
      const x = padding.left + (i / (labels.length - 1 || 1)) * chartW;
      xLabels += `<text class="chart-label" x="${x}" y="${height - 8}">${this.escapeHtml(this.truncate(label, 10))}</text>`;
    });

    let gridLines = '';
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH / 4) * i;
      gridLines += `<line class="grid-line" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}"/>`;
    }

    return `
      <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
        ${gridLines}
        <line class="axis-line" x1="${padding.left}" y1="${padding.top + chartH}" x2="${width - padding.right}" y2="${padding.top + chartH}"/>
        ${lines}
        ${dots}
        ${xLabels}
      </svg>`;
  }

  private renderLegend(datasets: Dataset[]): string {
    const items = datasets.map((ds, i) => {
      const color = ds.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
      return `<div class="legend-item"><span class="legend-dot" style="background:${color}"></span>${this.escapeHtml(ds.label)}</div>`;
    }).join('');
    return `<div class="legend">${items}</div>`;
  }

  private bindChartEvents(): void {
    this.shadowRoot?.querySelectorAll('.bar, .pie-slice').forEach((el) => {
      el.addEventListener('click', () => {
        const htmlEl = el as HTMLElement;
        const label = htmlEl.getAttribute('data-label') || '';
        const value = htmlEl.getAttribute('data-value') || '';
        this.emitAction('segment-click', {
          value: { label, value: parseFloat(value) },
          label: `Selected: ${label} (${value})`,
        });
      });
    });
  }

  private formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
  }

  private truncate(str: string, max: number): string {
    return str.length > max ? str.substring(0, max - 1) + '…' : str;
  }

  private normalizeDataset(ds: any): Dataset {
    if (Array.isArray(ds)) {
      return { label: '', data: ds.map((v: any) => Number(v) || 0) };
    }
    if (!ds || typeof ds !== 'object') {
      return { label: '', data: [] };
    }
    return {
      label: String(ds.label ?? ds.name ?? ds.title ?? ''),
      data: Array.isArray(ds.data || ds.values) ? (ds.data || ds.values).map((v: any) => Number(v) || 0) : [],
      color: ds.color ?? ds.backgroundColor ?? undefined,
    };
  }

  private escapeHtml(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private escapeAttr(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export const CHART_REGISTRATION: RegisterOptions = {
  schema: {
    type: { type: 'enum', enum: ['bar', 'line', 'pie', 'doughnut', 'area', 'radar', 'scatter'], default: 'bar' },
    title: { type: 'string', default: '' },
    labels: { type: 'array' },
    categories: { type: 'array' },
    xAxis: { type: 'array' },
    datasets: { type: 'array' },
    series: { type: 'array' },
    data: { type: 'array' },
    legend: { type: 'boolean', default: true },
    responsive: { type: 'boolean', default: true },
  },
  category: 'block',
  skeleton: {
    html: '<div class="livellm-skeleton" style="height:250px;border-radius:8px;background:#e8e8ff;"><div class="shimmer"></div></div>',
    height: '250px',
  },
};
