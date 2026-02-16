import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';

const ALERT_STYLES = `
  :host {
    display: block;
    margin: 8px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
  }
  .alert {
    padding: 12px 16px;
    border-radius: var(--livellm-border-radius, 8px);
    border-left: 4px solid;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    line-height: var(--livellm-line-height, 1.6);
  }
  .alert-icon {
    flex-shrink: 0;
    font-size: 16px;
    line-height: 1.6;
  }
  .alert-text {
    flex: 1;
    word-break: break-word;
  }
  .alert-info {
    background: #e8f4fd;
    border-color: var(--livellm-info, #74b9ff);
    color: #1a5276;
  }
  .alert-success {
    background: #e8f8f5;
    border-color: var(--livellm-success, #00cec9);
    color: #1a6e5e;
  }
  .alert-warning {
    background: #fef9e7;
    border-color: var(--livellm-warning, #fdcb6e);
    color: #7d6608;
  }
  .alert-error {
    background: #fdedec;
    border-color: var(--livellm-danger, #ff6b6b);
    color: #922b21;
  }
`;

const ICONS: Record<string, string> = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '❌',
};

export class LiveLLMAlert extends LiveLLMComponent {
  render(): void {
    const type = this._props.type || 'info';
    const text = this._props.text || '';
    const icon = ICONS[type] || ICONS.info;

    this.setStyles(ALERT_STYLES);
    this.setContent(`
      <div class="alert alert-${type}" role="alert">
        <span class="alert-icon">${icon}</span>
        <span class="alert-text">${this.escapeHtml(text)}</span>
      </div>
    `);
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

export const ALERT_REGISTRATION: RegisterOptions = {
  schema: {
    type: {
      type: 'enum',
      enum: ['info', 'success', 'warning', 'error'],
      default: 'info',
    },
    text: { type: 'string', required: true },
  },
  category: 'inline',
  skeleton: {
    html: '<div class="livellm-skeleton" style="height:48px;border-radius:8px;background:#e0e0e0;"></div>',
    height: '48px',
  },
};
