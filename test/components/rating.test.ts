import { describe, it, expect, beforeEach } from 'vitest';
import { LiveLLMRating, RATING_REGISTRATION } from '../../src/components/inline/rating';

const tagName = 'livellm-test-rating';
try { customElements.define(tagName, LiveLLMRating); } catch {}

function createRating(props: Record<string, any>): LiveLLMRating {
  const el = document.createElement(tagName) as LiveLLMRating;
  el.setAttribute('data-livellm', 'rating');
  el.setAttribute('data-props', JSON.stringify(props));
  document.body.appendChild(el);
  return el;
}

describe('Rating Component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should export registration with correct schema', () => {
    expect(RATING_REGISTRATION.schema.value).toBeDefined();
    expect(RATING_REGISTRATION.schema.value.required).toBe(true);
    expect(RATING_REGISTRATION.category).toBe('inline');
  });

  it('should render 5 stars by default', () => {
    const el = createRating({
      value: 3,
    });
    const shadow = el.shadowRoot!;
    const stars = shadow.querySelectorAll('.rating-star');
    expect(stars.length).toBe(5);
  });

  it('should render correct number of filled stars', () => {
    const el = createRating({
      value: 3,
      max: 5,
    });
    const shadow = el.shadowRoot!;
    const filled = shadow.querySelectorAll('.rating-star.filled');
    expect(filled.length).toBe(3);
  });

  it('should support custom max', () => {
    const el = createRating({
      value: 7,
      max: 10,
    });
    const shadow = el.shadowRoot!;
    const stars = shadow.querySelectorAll('.rating-star');
    expect(stars.length).toBe(10);
    const filled = shadow.querySelectorAll('.rating-star.filled');
    expect(filled.length).toBe(7);
  });

  it('should show value text when showValue is true', () => {
    const el = createRating({
      value: 4.5,
      max: 5,
      showValue: true,
    });
    const shadow = el.shadowRoot!;
    const valueText = shadow.querySelector('.rating-value');
    expect(valueText?.textContent).toContain('4.5');
    expect(valueText?.textContent).toContain('5');
  });

  it('should hide value text when showValue is false', () => {
    const el = createRating({
      value: 3,
      showValue: false,
    });
    const shadow = el.shadowRoot!;
    const valueText = shadow.querySelector('.rating-value');
    expect(valueText).toBeFalsy();
  });

  it('should render half stars for fractional values', () => {
    const el = createRating({
      value: 3.5,
      max: 5,
    });
    const shadow = el.shadowRoot!;
    const half = shadow.querySelectorAll('.rating-star.half');
    expect(half.length).toBe(1);
  });
});
