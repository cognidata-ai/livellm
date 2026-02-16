import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';

const PROGRESS_STYLES = `
  :host {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    vertical-align: middle;
  }
  .progress-wrapper {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: 12px;
  }
  .progress-bar {
    display: inline-block;
    width: 100px;
    height: 8px;
    background: var(--livellm-bg-secondary, #f0f0f0);
    border-radius: 4px;
    overflow: hidden;
    position: relative;
  }
  .progress-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
  }
  .progress-label {
    font-weight: 600;
    color: var(--livellm-text, #1a1a1a);
    white-space: nowrap;
  }
  .progress-text {
    color: var(--livellm-text-secondary, #6c757d);
    font-size: 11px;
  }
`;

export class LiveLLMProgress extends LiveLLMComponent {
  render(): void {
    const value = this._props.value ?? 0;
    const max = this._props.max ?? 100;
    const label = this._props.label || '';
    const color = this._props.color || 'var(--livellm-primary, #6c5ce7)';

    const pct = Math.min(100, Math.max(0, (value / max) * 100));

    this.setStyles(PROGRESS_STYLES);
    this.setContent(`
      <span class="progress-wrapper">
        ${label ? `<span class="progress-text">${this.escapeHtml(label)}</span>` : ''}
        <span class="progress-bar">
          <span class="progress-fill" style="width:${pct}%;background:${color}"></span>
        </span>
        <span class="progress-label">${Math.round(pct)}%</span>
      </span>
    `);
  }

  private escapeHtml(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export const PROGRESS_REGISTRATION: RegisterOptions = {
  schema: {
    value: { type: 'number', required: true, min: 0 },
    max: { type: 'number', default: 100, min: 1 },
    label: { type: 'string', default: '' },
    color: { type: 'string', default: '' },
  },
  category: 'inline',
  skeleton: {
    html: '<span style="display:inline-block;width:120px;height:10px;border-radius:4px;background:#e0e0e0;"></span>',
    height: '10px',
  },
};
