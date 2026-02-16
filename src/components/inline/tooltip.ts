import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';

const TOOLTIP_STYLES = `
  :host {
    display: inline;
    position: relative;
  }
  .tooltip-trigger {
    display: inline;
    border-bottom: 1px dashed var(--livellm-primary, #6c5ce7);
    color: var(--livellm-primary, #6c5ce7);
    cursor: help;
    font-family: inherit;
    font-size: inherit;
    position: relative;
  }
  .tooltip-popup {
    display: none;
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    background: #1a1a2e;
    color: #e8e8f0;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    line-height: 1.4;
    white-space: nowrap;
    max-width: 250px;
    white-space: normal;
    z-index: 1000;
    pointer-events: none;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
  .tooltip-popup::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-top-color: #1a1a2e;
  }
  .tooltip-trigger:hover .tooltip-popup {
    display: block;
  }
`;

export class LiveLLMTooltip extends LiveLLMComponent {
  render(): void {
    const text = this._props.text || '';
    const tip = this._props.tip || '';

    this.setStyles(TOOLTIP_STYLES);
    this.setContent(`
      <span class="tooltip-trigger">
        ${this.escapeHtml(text)}
        <span class="tooltip-popup">${this.escapeHtml(tip)}</span>
      </span>
    `);
  }

  private escapeHtml(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export const TOOLTIP_REGISTRATION: RegisterOptions = {
  schema: {
    text: { type: 'string', required: true },
    tip: { type: 'string', required: true },
  },
  category: 'inline',
  skeleton: {
    html: '<span style="display:inline-block;width:60px;height:16px;border-radius:2px;background:#e0e0e0;"></span>',
    height: '16px',
  },
};
