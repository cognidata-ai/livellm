import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';

const CONFIRM_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .confirm-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    padding: 16px;
    background: var(--livellm-bg-component, #ffffff);
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
    text-align: center;
  }
  .confirm-text {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 14px;
    line-height: var(--livellm-line-height, 1.6);
  }
  .confirm-buttons {
    display: flex;
    gap: 10px;
    justify-content: center;
  }
  .confirm-btn {
    padding: 8px 24px;
    border-radius: 6px;
    border: 2px solid transparent;
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
    font-weight: 500;
    transition: var(--livellm-transition, 0.2s ease);
    min-width: 100px;
  }
  .confirm-btn.primary {
    background: var(--livellm-primary, #6c5ce7);
    color: #fff;
    border-color: var(--livellm-primary, #6c5ce7);
  }
  .confirm-btn.primary:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }
  .confirm-btn.secondary {
    background: transparent;
    color: var(--livellm-text-secondary, #6c757d);
    border-color: var(--livellm-border, #e0e0e0);
  }
  .confirm-btn.secondary:hover {
    background: var(--livellm-bg-secondary, #f8f9fa);
    border-color: var(--livellm-text-secondary, #6c757d);
  }
  .confirm-btn.disabled {
    opacity: 0.6;
    cursor: not-allowed;
    pointer-events: none;
  }
  .confirm-result {
    margin-top: 10px;
    font-size: 13px;
    color: var(--livellm-text-secondary, #6c757d);
    font-style: italic;
  }
`;

export class LiveLLMConfirm extends LiveLLMComponent {
  private answered: boolean = false;
  private answer: boolean | null = null;

  render(): void {
    const text: string = this._props.text || 'Are you sure?';
    const confirmLabel: string = this._props.confirmLabel || 'Yes';
    const cancelLabel: string = this._props.cancelLabel || 'No';

    this.setStyles(CONFIRM_STYLES);

    let resultHtml = '';
    if (this.answered) {
      const label = this.answer ? confirmLabel : cancelLabel;
      resultHtml = `<div class="confirm-result">You selected: ${this.escapeHtml(label)}</div>`;
    }

    this.setContent(`
      <div class="confirm-container">
        <div class="confirm-text">${this.escapeHtml(text)}</div>
        <div class="confirm-buttons">
          <button class="confirm-btn primary${this.answered ? ' disabled' : ''}" data-action="confirm">${this.escapeHtml(confirmLabel)}</button>
          <button class="confirm-btn secondary${this.answered ? ' disabled' : ''}" data-action="cancel">${this.escapeHtml(cancelLabel)}</button>
        </div>
        ${resultHtml}
      </div>
    `);

    if (!this.answered) {
      this.shadowRoot?.querySelector('[data-action="confirm"]')?.addEventListener('click', () => {
        this.handleAction(true);
      });
      this.shadowRoot?.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
        this.handleAction(false);
      });
    }
  }

  private handleAction(confirmed: boolean): void {
    if (this.answered) return;

    this.answered = true;
    this.answer = confirmed;
    this.render();

    const label = confirmed
      ? (this._props.confirmLabel || 'Yes')
      : (this._props.cancelLabel || 'No');

    this.emitAction('confirm-response', {
      value: confirmed,
      label: `${confirmed ? 'Confirmed' : 'Declined'}: ${label}`,
      confirmed,
    });
  }

  private escapeHtml(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export const CONFIRM_REGISTRATION: RegisterOptions = {
  schema: {
    text: { type: 'string', default: 'Are you sure?' },
    confirmLabel: { type: 'string', default: 'Yes' },
    cancelLabel: { type: 'string', default: 'No' },
  },
  category: 'action',
  skeleton: {
    html: '<div style="height:90px;border-radius:8px;background:#e0e0e0;"></div>',
    height: '90px',
  },
};
