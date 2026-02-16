import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';

const RATING_STYLES = `
  :host {
    display: inline-flex;
    vertical-align: middle;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }
  .rating-star { font-size: 16px; line-height: 1; }
  .rating-star.filled { color: #f9ca24; }
  .rating-star.empty { color: var(--livellm-border, #e0e0e0); }
  .rating-star.half { position: relative; }
  .rating-star.half::before {
    content: '\u2605';
    color: #f9ca24;
    position: absolute;
    overflow: hidden;
    width: 50%;
  }
  .rating-value {
    margin-left: 4px;
    font-size: 13px;
    font-weight: 600;
    color: var(--livellm-text-secondary, #6c757d);
  }
`;

export class LiveLLMRating extends LiveLLMComponent {
  render(): void {
    const value: number = this._props.value ?? 0;
    const max: number = this._props.max ?? 5;
    const showValue: boolean = this._props.showValue ?? true;

    this.setStyles(RATING_STYLES);

    const stars = Array.from({ length: max }, (_, i) => {
      if (i < Math.floor(value)) {
        return '<span class="rating-star filled">\u2605</span>';
      } else if (i < value) {
        return '<span class="rating-star half">\u2606</span>';
      } else {
        return '<span class="rating-star empty">\u2606</span>';
      }
    }).join('');

    const valueText = showValue ? `<span class="rating-value">${value}/${max}</span>` : '';

    this.setContent(`${stars}${valueText}`);
  }
}

export const RATING_REGISTRATION: RegisterOptions = {
  schema: {
    value: { type: 'number', required: true, min: 0 },
    max: { type: 'number', default: 5, min: 1 },
    showValue: { type: 'boolean', default: true },
  },
  category: 'inline',
  skeleton: {
    html: '<span style="display:inline-block;width:100px;height:16px;background:#e0e0e0;border-radius:4px;"></span>',
    height: '16px',
  },
};
