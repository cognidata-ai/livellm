import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';

const CHOICE_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .choice-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    padding: 16px;
    background: var(--livellm-bg-component, #ffffff);
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
  }
  .choice-question {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 12px;
    line-height: var(--livellm-line-height, 1.6);
  }
  .choice-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .choice-option {
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
  .choice-option:hover {
    border-color: var(--livellm-primary, #6c5ce7);
    background: rgba(108, 92, 231, 0.04);
  }
  .choice-option.selected {
    border-color: var(--livellm-primary, #6c5ce7);
    background: rgba(108, 92, 231, 0.08);
    font-weight: 500;
  }
  .choice-option.disabled {
    opacity: 0.6;
    cursor: not-allowed;
    pointer-events: none;
  }
  .choice-radio {
    width: 18px;
    height: 18px;
    border: 2px solid var(--livellm-border, #e0e0e0);
    border-radius: 50%;
    margin-right: 10px;
    flex-shrink: 0;
    position: relative;
    transition: var(--livellm-transition, 0.2s ease);
  }
  .choice-option.selected .choice-radio {
    border-color: var(--livellm-primary, #6c5ce7);
  }
  .choice-option.selected .choice-radio::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 8px;
    height: 8px;
    background: var(--livellm-primary, #6c5ce7);
    border-radius: 50%;
  }
  .choice-label { flex: 1; }
  .choice-description {
    font-size: 12px;
    color: var(--livellm-text-secondary, #6c757d);
    margin-top: 2px;
  }
`;

interface ChoiceOption {
  label: string;
  value: string;
  description?: string;
}

export class LiveLLMChoice extends LiveLLMComponent {
  private selectedIndex: number = -1;
  private submitted: boolean = false;

  private normalizeOption(opt: ChoiceOption | string | null | undefined): ChoiceOption {
    if (!opt) return { label: '', value: '' };
    if (typeof opt === 'string') {
      return { label: opt, value: opt };
    }
    return {
      label: String(opt.label || opt.value || ''),
      value: String(opt.value || opt.label || ''),
      description: opt.description ? String(opt.description) : undefined,
    };
  }

  render(): void {
    const question: string = this._props.question || '';
    const rawOptions: (ChoiceOption | string)[] = this._props.options || this._props.choices || this._props.items || [];
    const options: ChoiceOption[] = rawOptions.map(o => this.normalizeOption(o));

    this.setStyles(CHOICE_STYLES);

    const optionsHtml = options
      .map(
        (opt, i) => `
        <button class="choice-option${i === this.selectedIndex ? ' selected' : ''}${this.submitted ? ' disabled' : ''}" data-index="${i}">
          <div class="choice-radio"></div>
          <div>
            <div class="choice-label">${this.escapeHtml(opt.label)}</div>
            ${opt.description ? `<div class="choice-description">${this.escapeHtml(opt.description)}</div>` : ''}
          </div>
        </button>`
      )
      .join('');

    this.setContent(`
      <div class="choice-container">
        ${question ? `<div class="choice-question">${this.escapeHtml(question)}</div>` : ''}
        <div class="choice-options">${optionsHtml}</div>
      </div>
    `);

    if (!this.submitted) {
      this.shadowRoot?.querySelectorAll('.choice-option').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const target = (e.currentTarget as HTMLElement);
          const index = parseInt(target.getAttribute('data-index') || '0', 10);
          this.selectOption(index);
        });
      });
    }
  }

  private selectOption(index: number): void {
    if (this.submitted) return;

    const rawOptions: (ChoiceOption | string)[] = this._props.options || this._props.choices || this._props.items || [];
    const options: ChoiceOption[] = rawOptions.map(o => this.normalizeOption(o));
    const option = options[index];
    if (!option) return;

    this.selectedIndex = index;
    this.submitted = true;
    this.render();

    this.emitAction('choice-select', {
      value: option.value || option.label,
      label: `Selected: ${option.label}`,
      index,
      option,
    });
  }

  private escapeHtml(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export const CHOICE_REGISTRATION: RegisterOptions = {
  schema: {
    question: { type: 'string', default: '' },
    options: { type: 'array' },
    choices: { type: 'array' },
    items: { type: 'array' },
  },
  category: 'action',
  skeleton: {
    html: '<div style="height:120px;border-radius:8px;background:#e0e0e0;"></div>',
    height: '120px',
  },
};
