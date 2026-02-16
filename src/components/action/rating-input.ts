import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';

const RATING_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .rating-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    padding: 16px;
    background: var(--livellm-bg-component, #ffffff);
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
    text-align: center;
  }
  .rating-label {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 12px;
    line-height: var(--livellm-line-height, 1.6);
  }
  .rating-stars {
    display: inline-flex;
    gap: 4px;
    margin-bottom: 8px;
  }
  .rating-star {
    width: 32px;
    height: 32px;
    cursor: pointer;
    border: none;
    background: transparent;
    padding: 0;
    transition: transform 0.15s ease;
    font-size: 28px;
    line-height: 1;
  }
  .rating-star:hover { transform: scale(1.2); }
  .rating-star.disabled {
    cursor: not-allowed;
    pointer-events: none;
  }
  .rating-star .star-filled { color: #f9ca24; }
  .rating-star .star-empty { color: var(--livellm-border, #e0e0e0); }
  .rating-value {
    font-size: 13px;
    color: var(--livellm-text-secondary, #6c757d);
    margin-top: 4px;
  }
  .rating-labels {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--livellm-text-secondary, #6c757d);
    margin-top: 4px;
  }
`;

export class LiveLLMRatingInput extends LiveLLMComponent {
  private rating: number = 0;
  private hoveredRating: number = 0;
  private submitted: boolean = false;

  render(): void {
    const label: string = this._props.label || 'Rate this response';
    const max: number = this._props.max ?? 5;
    const lowLabel: string = this._props.lowLabel || '';
    const highLabel: string = this._props.highLabel || '';

    this.setStyles(RATING_STYLES);

    const stars = Array.from({ length: max }, (_, i) => {
      const filled = i < (this.hoveredRating || this.rating);
      return `<button class="rating-star${this.submitted ? ' disabled' : ''}" data-value="${i + 1}">
        <span class="${filled ? 'star-filled' : 'star-empty'}">\u2605</span>
      </button>`;
    }).join('');

    const valueText = this.rating > 0 ? `${this.rating} / ${max}` : '';

    this.setContent(`
      <div class="rating-container">
        <div class="rating-label">${this.escapeHtml(label)}</div>
        <div class="rating-stars">${stars}</div>
        ${valueText ? `<div class="rating-value">${valueText}</div>` : ''}
        ${lowLabel || highLabel ? `<div class="rating-labels"><span>${this.escapeHtml(lowLabel)}</span><span>${this.escapeHtml(highLabel)}</span></div>` : ''}
      </div>
    `);

    if (!this.submitted) {
      this.shadowRoot?.querySelectorAll('.rating-star').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const val = parseInt((e.currentTarget as HTMLElement).getAttribute('data-value') || '0', 10);
          this.setRating(val);
        });
        btn.addEventListener('mouseenter', (e) => {
          this.hoveredRating = parseInt((e.currentTarget as HTMLElement).getAttribute('data-value') || '0', 10);
          this.render();
        });
        btn.addEventListener('mouseleave', () => {
          this.hoveredRating = 0;
          this.render();
        });
      });
    }
  }

  private setRating(value: number): void {
    if (this.submitted) return;

    this.rating = value;
    this.submitted = true;
    this.hoveredRating = 0;
    this.render();

    this.emitAction('rating-submit', {
      value,
      label: `Rated: ${value} / ${this._props.max ?? 5}`,
      max: this._props.max ?? 5,
    });
  }

  private escapeHtml(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export const RATING_INPUT_REGISTRATION: RegisterOptions = {
  schema: {
    label: { type: 'string', default: 'Rate this response' },
    max: { type: 'number', default: 5, min: 1, max: 10 },
    lowLabel: { type: 'string', default: '' },
    highLabel: { type: 'string', default: '' },
  },
  category: 'action',
  skeleton: {
    html: '<div style="height:80px;border-radius:8px;background:#e0e0e0;"></div>',
    height: '80px',
  },
};
