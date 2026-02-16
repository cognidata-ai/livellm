import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LiveLLMSlider } from '../../src/components/action/slider';

const tagName = 'livellm-test-slider';
try { customElements.define(tagName, LiveLLMSlider); } catch {}

function createSlider(props: Record<string, any> = {}): LiveLLMSlider {
  const el = document.createElement(tagName) as LiveLLMSlider;
  el.setAttribute('data-livellm', 'slider');
  el.setAttribute('data-props', JSON.stringify(props));
  document.body.appendChild(el);
  return el;
}

describe('Slider Component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should render label and range input', () => {
    const el = createSlider({ label: 'Temperature' });
    expect(el.shadowRoot!.querySelector('.slider-label')?.textContent).toContain('Temperature');
    expect(el.shadowRoot!.querySelector('.slider-input')).toBeTruthy();
  });

  it('should set min/max/step on range input', () => {
    const el = createSlider({ min: 10, max: 50, step: 5 });
    const input = el.shadowRoot!.querySelector('.slider-input') as HTMLInputElement;
    expect(input.min).toBe('10');
    expect(input.max).toBe('50');
    expect(input.step).toBe('5');
  });

  it('should show default value at midpoint', () => {
    const el = createSlider({ min: 0, max: 100 });
    const value = el.shadowRoot!.querySelector('.slider-value');
    expect(value?.textContent).toContain('50');
  });

  it('should show custom default value', () => {
    const el = createSlider({ min: 0, max: 100, defaultValue: 75 });
    const value = el.shadowRoot!.querySelector('.slider-value');
    expect(value?.textContent).toContain('75');
  });

  it('should show suffix', () => {
    const el = createSlider({ suffix: '%', defaultValue: 50 });
    const value = el.shadowRoot!.querySelector('.slider-value');
    expect(value?.textContent).toContain('%');
  });

  it('should show range labels', () => {
    const el = createSlider({ min: 0, max: 100, showRange: true });
    const range = el.shadowRoot!.querySelector('.slider-range');
    expect(range?.textContent).toContain('0');
    expect(range?.textContent).toContain('100');
  });

  it('should have a submit button', () => {
    const el = createSlider();
    expect(el.shadowRoot!.querySelector('.slider-submit')).toBeTruthy();
  });

  it('should emit action on submit', () => {
    const el = createSlider({ min: 0, max: 100, defaultValue: 75 });
    const handler = vi.fn();
    el.addEventListener('livellm:action', (e) => handler((e as CustomEvent).detail));

    const btn = el.shadowRoot!.querySelector('.slider-submit') as HTMLElement;
    btn.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].action).toBe('slider-submit');
    expect(handler.mock.calls[0][0].data.value).toBe(75);
  });

  it('should disable slider after submission', () => {
    const el = createSlider();
    const btn = el.shadowRoot!.querySelector('.slider-submit') as HTMLElement;
    btn.click();

    const input = el.shadowRoot!.querySelector('.slider-input') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });
});
