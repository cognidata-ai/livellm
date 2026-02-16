import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';

const TEXT_INPUT_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .ti-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    padding: 16px;
    background: var(--livellm-bg-component, #ffffff);
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
  }
  .ti-label {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 4px;
    line-height: var(--livellm-line-height, 1.6);
  }
  .ti-hint {
    font-size: 12px;
    color: var(--livellm-text-secondary, #6c757d);
    margin-bottom: 10px;
  }
  .ti-input-row {
    display: flex;
    gap: 10px;
    align-items: flex-end;
  }
  .ti-input, .ti-textarea {
    flex: 1;
    padding: 8px 12px;
    border: 2px solid var(--livellm-border, #e0e0e0);
    border-radius: 6px;
    font-family: inherit;
    font-size: 14px;
    color: var(--livellm-text, #1a1a1a);
    background: var(--livellm-bg, #ffffff);
    transition: var(--livellm-transition, 0.2s ease);
    resize: vertical;
  }
  .ti-textarea {
    min-height: 60px;
  }
  .ti-input:focus, .ti-textarea:focus {
    outline: none;
    border-color: var(--livellm-primary, #6c5ce7);
  }
  .ti-input:disabled, .ti-textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .ti-submit {
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
    align-self: flex-end;
  }
  .ti-submit:hover { opacity: 0.9; }
  .ti-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .ti-char-count {
    font-size: 11px;
    color: var(--livellm-text-secondary, #6c757d);
    text-align: right;
    margin-top: 4px;
  }
  .ti-char-count.over { color: #e74c3c; }
  .ti-result {
    margin-top: 8px;
    font-size: 13px;
    color: var(--livellm-text-secondary, #6c757d);
    font-style: italic;
  }
`;

export class LiveLLMTextInput extends LiveLLMComponent {
  private text: string = '';
  private submitted: boolean = false;

  render(): void {
    const label: string = this._props.label || 'Enter your response';
    const placeholder: string = this._props.placeholder || '';
    const hint: string = this._props.hint || '';
    const multiline: boolean = this._props.multiline ?? false;
    const maxLength: number = this._props.maxLength ?? 0;

    this.setStyles(TEXT_INPUT_STYLES);

    const inputEl = multiline
      ? `<textarea class="ti-textarea" placeholder="${this.escapeAttr(placeholder)}" ${maxLength ? `maxlength="${maxLength}"` : ''} ${this.submitted ? 'disabled' : ''}>${this.escapeHtml(this.text)}</textarea>`
      : `<input type="text" class="ti-input" placeholder="${this.escapeAttr(placeholder)}" value="${this.escapeAttr(this.text)}" ${maxLength ? `maxlength="${maxLength}"` : ''} ${this.submitted ? 'disabled' : ''} />`;

    const charCount = maxLength > 0
      ? `<div class="ti-char-count${this.text.length > maxLength ? ' over' : ''}">${this.text.length}/${maxLength}</div>`
      : '';

    const resultHtml = this.submitted
      ? `<div class="ti-result">Submitted: ${this.escapeHtml(this.text.length > 60 ? this.text.substring(0, 60) + '...' : this.text)}</div>`
      : '';

    this.setContent(`
      <div class="ti-container">
        <div class="ti-label">${this.escapeHtml(label)}</div>
        ${hint ? `<div class="ti-hint">${this.escapeHtml(hint)}</div>` : ''}
        <div class="ti-input-row">
          ${inputEl}
          <button class="ti-submit"${this.submitted ? ' disabled' : ''}>Submit</button>
        </div>
        ${charCount}
        ${resultHtml}
      </div>
    `);

    if (!this.submitted) {
      const inputElement = this.shadowRoot?.querySelector('.ti-input, .ti-textarea') as HTMLInputElement | HTMLTextAreaElement;
      const btn = this.shadowRoot?.querySelector('.ti-submit');

      inputElement?.addEventListener('input', (e) => {
        this.text = (e.target as HTMLInputElement | HTMLTextAreaElement).value;
        if (maxLength > 0) {
          const countEl = this.shadowRoot?.querySelector('.ti-char-count');
          if (countEl) {
            countEl.textContent = `${this.text.length}/${maxLength}`;
            countEl.classList.toggle('over', this.text.length > maxLength);
          }
        }
      });

      // Submit on Enter for single-line input
      if (!multiline) {
        inputElement?.addEventListener('keydown', (e) => {
          if ((e as KeyboardEvent).key === 'Enter' && this.text.trim()) {
            this.submitText();
          }
        });
      }

      btn?.addEventListener('click', () => {
        if (this.text.trim()) {
          this.submitText();
        }
      });
    }
  }

  private submitText(): void {
    if (this.submitted || !this.text.trim()) return;

    this.submitted = true;
    this.render();

    this.emitAction('text-submit', {
      value: this.text,
      label: this.text.length > 80 ? this.text.substring(0, 80) + '...' : this.text,
      length: this.text.length,
    });
  }

  private escapeHtml(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private escapeAttr(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export const TEXT_INPUT_REGISTRATION: RegisterOptions = {
  schema: {
    label: { type: 'string', default: 'Enter your response' },
    placeholder: { type: 'string', default: '' },
    hint: { type: 'string', default: '' },
    multiline: { type: 'boolean', default: false },
    maxLength: { type: 'number', default: 0 },
  },
  category: 'action',
  skeleton: {
    html: '<div style="height:70px;border-radius:8px;background:#e0e0e0;"></div>',
    height: '70px',
  },
};
