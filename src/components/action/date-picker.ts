import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';

const DATE_PICKER_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .dp-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    padding: 16px;
    background: var(--livellm-bg-component, #ffffff);
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
  }
  .dp-label {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 10px;
    line-height: var(--livellm-line-height, 1.6);
  }
  .dp-input-row {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .dp-input {
    flex: 1;
    padding: 8px 12px;
    border: 2px solid var(--livellm-border, #e0e0e0);
    border-radius: 6px;
    font-family: inherit;
    font-size: 14px;
    color: var(--livellm-text, #1a1a1a);
    background: var(--livellm-bg, #ffffff);
    transition: var(--livellm-transition, 0.2s ease);
  }
  .dp-input:focus {
    outline: none;
    border-color: var(--livellm-primary, #6c5ce7);
  }
  .dp-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .dp-submit {
    padding: 8px 20px;
    border-radius: 6px;
    border: none;
    background: var(--livellm-primary, #6c5ce7);
    color: #fff;
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
    font-weight: 500;
    transition: var(--livellm-transition, 0.2s ease);
    white-space: nowrap;
  }
  .dp-submit:hover { opacity: 0.9; }
  .dp-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .dp-result {
    margin-top: 8px;
    font-size: 13px;
    color: var(--livellm-text-secondary, #6c757d);
    font-style: italic;
  }
`;

export class LiveLLMDatePicker extends LiveLLMComponent {
  private selectedDate: string = '';
  private submitted: boolean = false;

  render(): void {
    const label: string = this._props.label || 'Select a date';
    const min: string = this._props.min || '';
    const max: string = this._props.max || '';
    const includeTime: boolean = this._props.includeTime ?? false;
    const inputType = includeTime ? 'datetime-local' : 'date';

    this.setStyles(DATE_PICKER_STYLES);

    const resultHtml = this.submitted && this.selectedDate
      ? `<div class="dp-result">Selected: ${this.escapeHtml(this.formatDate(this.selectedDate, includeTime))}</div>`
      : '';

    this.setContent(`
      <div class="dp-container">
        <div class="dp-label">${this.escapeHtml(label)}</div>
        <div class="dp-input-row">
          <input type="${inputType}" class="dp-input"
            ${min ? `min="${this.escapeHtml(min)}"` : ''}
            ${max ? `max="${this.escapeHtml(max)}"` : ''}
            ${this.selectedDate ? `value="${this.escapeHtml(this.selectedDate)}"` : ''}
            ${this.submitted ? 'disabled' : ''}
          />
          <button class="dp-submit"${this.submitted ? ' disabled' : ''}>Submit</button>
        </div>
        ${resultHtml}
      </div>
    `);

    if (!this.submitted) {
      const input = this.shadowRoot?.querySelector('.dp-input') as HTMLInputElement;
      const btn = this.shadowRoot?.querySelector('.dp-submit');

      input?.addEventListener('change', (e) => {
        this.selectedDate = (e.target as HTMLInputElement).value;
      });

      btn?.addEventListener('click', () => {
        if (this.selectedDate) {
          this.submitDate();
        }
      });
    }
  }

  private submitDate(): void {
    if (this.submitted || !this.selectedDate) return;

    this.submitted = true;
    this.render();

    const includeTime = this._props.includeTime ?? false;
    this.emitAction('date-select', {
      value: this.selectedDate,
      label: `Selected date: ${this.formatDate(this.selectedDate, includeTime)}`,
      iso: this.selectedDate,
    });
  }

  private formatDate(dateStr: string, includeTime: boolean): string {
    try {
      const d = new Date(dateStr);
      if (includeTime) {
        return d.toLocaleString();
      }
      return d.toLocaleDateString();
    } catch {
      return dateStr;
    }
  }

  private escapeHtml(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export const DATE_PICKER_REGISTRATION: RegisterOptions = {
  schema: {
    label: { type: 'string', default: 'Select a date' },
    min: { type: 'string', default: '' },
    max: { type: 'string', default: '' },
    includeTime: { type: 'boolean', default: false },
  },
  category: 'action',
  skeleton: {
    html: '<div style="height:70px;border-radius:8px;background:#e0e0e0;"></div>',
    height: '70px',
  },
};
