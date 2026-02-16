import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';

const COUNTER_STYLES = `
  :host {
    display: inline-flex;
    vertical-align: middle;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .counter-value {
    font-size: 24px;
    font-weight: 800;
    color: var(--livellm-primary, #6c5ce7);
    font-variant-numeric: tabular-nums;
  }
  .counter-label {
    font-size: 13px;
    color: var(--livellm-text-secondary, #6c757d);
    font-weight: 500;
  }
  .counter-suffix {
    font-size: 16px;
    font-weight: 600;
    color: var(--livellm-primary, #6c5ce7);
  }
  .counter-group {
    display: inline-flex;
    align-items: baseline;
    gap: 2px;
  }
`;

export class LiveLLMCounter extends LiveLLMComponent {
  render(): void {
    const value: number = this._props.value ?? 0;
    const label: string = this._props.label || '';
    const prefix: string = this._props.prefix || '';
    const suffix: string = this._props.suffix || '';
    const format: string = this._props.format || 'number'; // number, compact, percent

    this.setStyles(COUNTER_STYLES);

    let displayValue: string;
    switch (format) {
      case 'compact':
        displayValue = this.formatCompact(value);
        break;
      case 'percent':
        displayValue = `${value}`;
        break;
      default:
        displayValue = value.toLocaleString();
    }

    const displaySuffix = format === 'percent' ? '%' : suffix;

    this.setContent(`
      ${label ? `<span class="counter-label">${this.escapeHtml(label)}</span>` : ''}
      <span class="counter-group">
        ${prefix ? `<span class="counter-suffix">${this.escapeHtml(prefix)}</span>` : ''}
        <span class="counter-value">${this.escapeHtml(displayValue)}</span>
        ${displaySuffix ? `<span class="counter-suffix">${this.escapeHtml(displaySuffix)}</span>` : ''}
      </span>
    `);
  }

  private formatCompact(n: number): string {
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n);
  }

  private escapeHtml(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export const COUNTER_REGISTRATION: RegisterOptions = {
  schema: {
    value: { type: 'number', required: true },
    label: { type: 'string', default: '' },
    prefix: { type: 'string', default: '' },
    suffix: { type: 'string', default: '' },
    format: { type: 'string', default: 'number' },
  },
  category: 'inline',
  skeleton: {
    html: '<span style="display:inline-block;width:60px;height:24px;background:#e0e0e0;border-radius:4px;"></span>',
    height: '24px',
  },
};
