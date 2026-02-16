import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LiveLLMRatingInput } from '../../src/components/action/rating-input';

const tagName = 'livellm-test-rating';
try { customElements.define(tagName, LiveLLMRatingInput); } catch {}

function createRating(props: Record<string, any> = {}): LiveLLMRatingInput {
  const el = document.createElement(tagName) as LiveLLMRatingInput;
  el.setAttribute('data-livellm', 'rating-input');
  el.setAttribute('data-props', JSON.stringify(props));
  document.body.appendChild(el);
  return el;
}

describe('Rating Input Component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should render 5 stars by default', () => {
    const el = createRating({ label: 'Rate this' });
    const stars = el.shadowRoot!.querySelectorAll('.rating-star');
    expect(stars.length).toBe(5);
  });

  it('should render custom number of stars', () => {
    const el = createRating({ max: 10 });
    const stars = el.shadowRoot!.querySelectorAll('.rating-star');
    expect(stars.length).toBe(10);
  });

  it('should render the label', () => {
    const el = createRating({ label: 'How helpful was this?' });
    expect(el.shadowRoot!.querySelector('.rating-label')?.textContent).toContain('How helpful was this?');
  });

  it('should emit action on star click', () => {
    const el = createRating({ label: 'Rate', max: 5 });
    const handler = vi.fn();
    el.addEventListener('livellm:action', (e) => handler((e as CustomEvent).detail));

    const star = el.shadowRoot!.querySelector('[data-value="4"]') as HTMLElement;
    star.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].action).toBe('rating-submit');
    expect(handler.mock.calls[0][0].data.value).toBe(4);
    expect(handler.mock.calls[0][0].data.max).toBe(5);
  });

  it('should show rating value after selection', () => {
    const el = createRating({ max: 5 });
    const star = el.shadowRoot!.querySelector('[data-value="3"]') as HTMLElement;
    star.click();

    const valueEl = el.shadowRoot!.querySelector('.rating-value');
    expect(valueEl?.textContent).toContain('3 / 5');
  });

  it('should disable stars after selection', () => {
    const el = createRating();
    const star = el.shadowRoot!.querySelector('[data-value="2"]') as HTMLElement;
    star.click();

    const disabled = el.shadowRoot!.querySelectorAll('.rating-star.disabled');
    expect(disabled.length).toBe(5);
  });

  it('should render low and high labels', () => {
    const el = createRating({
      lowLabel: 'Poor',
      highLabel: 'Excellent',
    });

    const labels = el.shadowRoot!.querySelector('.rating-labels');
    expect(labels?.textContent).toContain('Poor');
    expect(labels?.textContent).toContain('Excellent');
  });
});
