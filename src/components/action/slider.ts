import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';

const SLIDER_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .slider-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    padding: 16px;
    background: var(--livellm-bg-component, #ffffff);
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
  }
  .slider-label {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 12px;
    line-height: var(--livellm-line-height, 1.6);
  }
  .slider-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .slider-input {
    flex: 1;
    -webkit-appearance: none;
    appearance: none;
    height: 6px;
    background: var(--livellm-border, #e0e0e0);
    border-radius: 3px;
    outline: none;
  }
  .slider-input::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--livellm-primary, #6c5ce7);
    cursor: pointer;
    transition: transform 0.15s ease;
  }
  .slider-input::-webkit-slider-thumb:hover { transform: scale(1.15); }
  .slider-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .slider-input:disabled::-webkit-slider-thumb { cursor: not-allowed; }
  .slider-value {
    min-width: 50px;
    text-align: center;
    font-weight: 600;
    font-size: 16px;
    color: var(--livellm-primary, #6c5ce7);
  }
  .slider-submit {
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
  .slider-submit:hover { opacity: 0.9; }
  .slider-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .slider-range {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--livellm-text-secondary, #6c757d);
    margin-top: 4px;
  }
  .slider-result {
    margin-top: 8px;
    font-size: 13px;
    color: var(--livellm-text-secondary, #6c757d);
    font-style: italic;
  }
`;

export class LiveLLMSlider extends LiveLLMComponent {
  private value: number = 0;
  private submitted: boolean = false;

  render(): void {
    const label: string = this._props.label || 'Select a value';
    const min: number = this._props.min ?? 0;
    const max: number = this._props.max ?? 100;
    const step: number = this._props.step ?? 1;
    const defaultValue: number = this._props.defaultValue ?? Math.round((min + max) / 2);
    const suffix: string = this._props.suffix || '';
    const showRange: boolean = this._props.showRange ?? true;

    if (!this.submitted && this.value === 0) {
      this.value = defaultValue;
    }

    this.setStyles(SLIDER_STYLES);

    const resultHtml = this.submitted
      ? `<div class="slider-result">Submitted: ${this.value}${suffix}</div>`
      : '';

    this.setContent(`
      <div class="slider-container">
        <div class="slider-label">${this.escapeHtml(label)}</div>
        <div class="slider-row">
          <input type="range" class="slider-input" min="${min}" max="${max}" step="${step}" value="${this.value}" ${this.submitted ? 'disabled' : ''} />
          <span class="slider-value">${this.value}${this.escapeHtml(suffix)}</span>
          ${!this.submitted ? '<button class="slider-submit">Submit</button>' : ''}
        </div>
        ${showRange ? `<div class="slider-range"><span>${min}${this.escapeHtml(suffix)}</span><span>${max}${this.escapeHtml(suffix)}</span></div>` : ''}
        ${resultHtml}
      </div>
    `);

    if (!this.submitted) {
      const input = this.shadowRoot?.querySelector('.slider-input') as HTMLInputElement;
      const valueEl = this.shadowRoot?.querySelector('.slider-value');
      const btn = this.shadowRoot?.querySelector('.slider-submit');

      input?.addEventListener('input', (e) => {
        this.value = parseFloat((e.target as HTMLInputElement).value);
        if (valueEl) {
          valueEl.textContent = `${this.value}${suffix}`;
        }
      });

      btn?.addEventListener('click', () => {
        this.submitValue();
      });
    }
  }

  private submitValue(): void {
    if (this.submitted) return;

    this.submitted = true;
    this.render();

    const suffix = this._props.suffix || '';
    this.emitAction('slider-submit', {
      value: this.value,
      label: `Selected: ${this.value}${suffix}`,
      min: this._props.min ?? 0,
      max: this._props.max ?? 100,
    });
  }

  private escapeHtml(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export const SLIDER_REGISTRATION: RegisterOptions = {
  schema: {
    label: { type: 'string', default: 'Select a value' },
    min: { type: 'number', default: 0 },
    max: { type: 'number', default: 100 },
    step: { type: 'number', default: 1 },
    defaultValue: { type: 'number' },
    suffix: { type: 'string', default: '' },
    showRange: { type: 'boolean', default: true },
  },
  category: 'action',
  skeleton: {
    html: '<div style="height:80px;border-radius:8px;background:#e0e0e0;"></div>',
    height: '80px',
  },
};
