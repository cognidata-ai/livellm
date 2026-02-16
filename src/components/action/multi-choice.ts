import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';

const MULTI_CHOICE_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .mc-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    padding: 16px;
    background: var(--livellm-bg-component, #ffffff);
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
  }
  .mc-question {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 4px;
    line-height: var(--livellm-line-height, 1.6);
  }
  .mc-hint {
    font-size: 12px;
    color: var(--livellm-text-secondary, #6c757d);
    margin-bottom: 12px;
  }
  .mc-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .mc-option {
    display: flex;
    align-items: center;
    padding: 10px 14px;
    border: 2px solid var(--livellm-border, #e0e0e0);
    border-radius: 6px;
    cursor: pointer;
    transition: var(--livellm-transition, 0.2s ease);
    background: var(--livellm-bg, #ffffff);
    font-family: inherit;
    font-size: 14px;
    color: inherit;
    text-align: left;
    width: 100%;
    box-sizing: border-box;
  }
  .mc-option:hover {
    border-color: var(--livellm-primary, #6c5ce7);
    background: rgba(108, 92, 231, 0.04);
  }
  .mc-option.selected {
    border-color: var(--livellm-primary, #6c5ce7);
    background: rgba(108, 92, 231, 0.08);
  }
  .mc-option.disabled {
    opacity: 0.6;
    cursor: not-allowed;
    pointer-events: none;
  }
  .mc-checkbox {
    width: 18px;
    height: 18px;
    border: 2px solid var(--livellm-border, #e0e0e0);
    border-radius: 4px;
    margin-right: 10px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: var(--livellm-transition, 0.2s ease);
  }
  .mc-option.selected .mc-checkbox {
    border-color: var(--livellm-primary, #6c5ce7);
    background: var(--livellm-primary, #6c5ce7);
  }
  .mc-checkbox-check {
    display: none;
    color: #fff;
    font-size: 12px;
    font-weight: bold;
  }
  .mc-option.selected .mc-checkbox-check { display: block; }
  .mc-label { flex: 1; }
  .mc-submit {
    margin-top: 12px;
    padding: 8px 24px;
    border-radius: 6px;
    border: none;
    background: var(--livellm-primary, #6c5ce7);
    color: #fff;
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
    font-weight: 500;
    transition: var(--livellm-transition, 0.2s ease);
  }
  .mc-submit:hover { opacity: 0.9; }
  .mc-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

interface MultiChoiceOption {
  label: string;
  value: string;
}

export class LiveLLMMultiChoice extends LiveLLMComponent {
  private selectedIndices: Set<number> = new Set();
  private submitted: boolean = false;

  private normalizeOption(opt: MultiChoiceOption | string): MultiChoiceOption {
    if (typeof opt === 'string') {
      return { label: opt, value: opt };
    }
    return {
      label: opt.label || opt.value || '',
      value: opt.value || opt.label || '',
    };
  }

  render(): void {
    const question: string = this._props.question || '';
    const rawOptions: (MultiChoiceOption | string)[] = this._props.options || this._props.choices || this._props.items || [];
    const options: MultiChoiceOption[] = rawOptions.map(o => this.normalizeOption(o));
    const min: number = this._props.min ?? 1;
    const max: number = this._props.max ?? options.length;

    this.setStyles(MULTI_CHOICE_STYLES);

    const optionsHtml = options
      .map(
        (opt, i) => `
        <button class="mc-option${this.selectedIndices.has(i) ? ' selected' : ''}${this.submitted ? ' disabled' : ''}" data-index="${i}">
          <div class="mc-checkbox"><span class="mc-checkbox-check">\u2713</span></div>
          <div class="mc-label">${this.escapeHtml(opt.label)}</div>
        </button>`
      )
      .join('');

    const canSubmit = this.selectedIndices.size >= min && this.selectedIndices.size <= max;

    this.setContent(`
      <div class="mc-container">
        ${question ? `<div class="mc-question">${this.escapeHtml(question)}</div>` : ''}
        <div class="mc-hint">Select ${min === max ? min : `${min}-${max}`} option${max > 1 ? 's' : ''}</div>
        <div class="mc-options">${optionsHtml}</div>
        ${!this.submitted ? `<button class="mc-submit"${!canSubmit ? ' disabled' : ''}>Submit</button>` : ''}
      </div>
    `);

    if (!this.submitted) {
      this.shadowRoot?.querySelectorAll('.mc-option').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const target = (e.currentTarget as HTMLElement);
          const index = parseInt(target.getAttribute('data-index') || '0', 10);
          this.toggleOption(index, max);
        });
      });

      this.shadowRoot?.querySelector('.mc-submit')?.addEventListener('click', () => {
        this.submitSelection();
      });
    }
  }

  private toggleOption(index: number, max: number): void {
    if (this.submitted) return;

    if (this.selectedIndices.has(index)) {
      this.selectedIndices.delete(index);
    } else if (this.selectedIndices.size < max) {
      this.selectedIndices.add(index);
    }
    this.render();
  }

  private submitSelection(): void {
    if (this.submitted) return;

    const rawOptions: (MultiChoiceOption | string)[] = this._props.options || this._props.choices || this._props.items || [];
    const options: MultiChoiceOption[] = rawOptions.map(o => this.normalizeOption(o));
    const selected = Array.from(this.selectedIndices)
      .sort()
      .map((i) => options[i])
      .filter(Boolean);

    this.submitted = true;
    this.render();

    this.emitAction('multi-choice-submit', {
      value: selected.map((o) => o.value || o.label),
      label: `Selected: ${selected.map((o) => o.label).join(', ')}`,
      selected,
      indices: Array.from(this.selectedIndices).sort(),
    });
  }

  private escapeHtml(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export const MULTI_CHOICE_REGISTRATION: RegisterOptions = {
  schema: {
    question: { type: 'string', default: '' },
    options: { type: 'array' },
    choices: { type: 'array' },
    items: { type: 'array' },
    min: { type: 'number', default: 1, min: 0 },
    max: { type: 'number', default: 10, min: 1 },
  },
  category: 'action',
  skeleton: {
    html: '<div style="height:140px;border-radius:8px;background:#e0e0e0;"></div>',
    height: '140px',
  },
};
