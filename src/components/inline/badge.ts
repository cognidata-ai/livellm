import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';

const BADGE_STYLES = `
  :host {
    display: inline-block;
    vertical-align: middle;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 10px;
    border-radius: 12px;
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: 12px;
    font-weight: 600;
    line-height: 1.5;
    white-space: nowrap;
    transition: var(--livellm-transition, 0.2s ease);
  }
  .badge-solid-green {
    background: var(--livellm-success, #00cec9);
    color: #fff;
  }
  .badge-solid-red {
    background: var(--livellm-danger, #ff6b6b);
    color: #fff;
  }
  .badge-solid-blue {
    background: var(--livellm-info, #74b9ff);
    color: #fff;
  }
  .badge-solid-yellow {
    background: var(--livellm-warning, #fdcb6e);
    color: #333;
  }
  .badge-solid-gray {
    background: #adb5bd;
    color: #fff;
  }
  .badge-solid-purple {
    background: var(--livellm-primary, #6c5ce7);
    color: #fff;
  }
  .badge-outline-green {
    border: 1.5px solid var(--livellm-success, #00cec9);
    color: var(--livellm-success, #00cec9);
    background: transparent;
  }
  .badge-outline-red {
    border: 1.5px solid var(--livellm-danger, #ff6b6b);
    color: var(--livellm-danger, #ff6b6b);
    background: transparent;
  }
  .badge-outline-blue {
    border: 1.5px solid var(--livellm-info, #74b9ff);
    color: var(--livellm-info, #74b9ff);
    background: transparent;
  }
  .badge-outline-yellow {
    border: 1.5px solid var(--livellm-warning, #fdcb6e);
    color: var(--livellm-warning, #fdcb6e);
    background: transparent;
  }
  .badge-outline-gray {
    border: 1.5px solid #adb5bd;
    color: #adb5bd;
    background: transparent;
  }
  .badge-outline-purple {
    border: 1.5px solid var(--livellm-primary, #6c5ce7);
    color: var(--livellm-primary, #6c5ce7);
    background: transparent;
  }
`;

export class LiveLLMBadge extends LiveLLMComponent {
  render(): void {
    const text = this._props.text || '';
    const color = this._props.color || 'blue';
    const variant = this._props.variant || 'solid';

    this.setStyles(BADGE_STYLES);
    this.setContent(`
      <span class="badge badge-${variant}-${color}">${this.escapeHtml(text)}</span>
    `);
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

export const BADGE_REGISTRATION: RegisterOptions = {
  schema: {
    text: { type: 'string', required: true },
    color: {
      type: 'enum',
      enum: ['green', 'red', 'blue', 'yellow', 'gray', 'purple'],
      default: 'blue',
    },
    variant: {
      type: 'enum',
      enum: ['solid', 'outline'],
      default: 'solid',
    },
  },
  category: 'inline',
  skeleton: {
    html: '<span style="display:inline-block;width:60px;height:20px;border-radius:12px;background:#e0e0e0;"></span>',
    height: '20px',
  },
};
