import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LiveLLMDatePicker } from '../../src/components/action/date-picker';

const tagName = 'livellm-test-date-picker';
try { customElements.define(tagName, LiveLLMDatePicker); } catch {}

function createDatePicker(props: Record<string, any> = {}): LiveLLMDatePicker {
  const el = document.createElement(tagName) as LiveLLMDatePicker;
  el.setAttribute('data-livellm', 'date-picker');
  el.setAttribute('data-props', JSON.stringify(props));
  document.body.appendChild(el);
  return el;
}

describe('Date Picker Component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should render label and date input', () => {
    const el = createDatePicker({ label: 'Select a date' });
    expect(el.shadowRoot!.querySelector('.dp-label')?.textContent).toContain('Select a date');
    const input = el.shadowRoot!.querySelector('.dp-input') as HTMLInputElement;
    expect(input.type).toBe('date');
  });

  it('should render datetime-local when includeTime is true', () => {
    const el = createDatePicker({ includeTime: true });
    const input = el.shadowRoot!.querySelector('.dp-input') as HTMLInputElement;
    expect(input.type).toBe('datetime-local');
  });

  it('should set min/max attributes', () => {
    const el = createDatePicker({ min: '2024-01-01', max: '2024-12-31' });
    const input = el.shadowRoot!.querySelector('.dp-input') as HTMLInputElement;
    expect(input.min).toBe('2024-01-01');
    expect(input.max).toBe('2024-12-31');
  });

  it('should have a submit button', () => {
    const el = createDatePicker();
    expect(el.shadowRoot!.querySelector('.dp-submit')).toBeTruthy();
  });

  it('should emit action when date is selected and submitted', () => {
    const el = createDatePicker({ label: 'When?' });
    const handler = vi.fn();
    el.addEventListener('livellm:action', (e) => handler((e as CustomEvent).detail));

    const input = el.shadowRoot!.querySelector('.dp-input') as HTMLInputElement;
    input.value = '2024-06-15';
    input.dispatchEvent(new Event('change'));

    const btn = el.shadowRoot!.querySelector('.dp-submit') as HTMLElement;
    btn.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].action).toBe('date-select');
    expect(handler.mock.calls[0][0].data.value).toBe('2024-06-15');
  });

  it('should disable input after submission', () => {
    const el = createDatePicker();
    const input = el.shadowRoot!.querySelector('.dp-input') as HTMLInputElement;
    input.value = '2024-06-15';
    input.dispatchEvent(new Event('change'));

    const btn = el.shadowRoot!.querySelector('.dp-submit') as HTMLElement;
    btn.click();

    const disabledInput = el.shadowRoot!.querySelector('.dp-input') as HTMLInputElement;
    expect(disabledInput.disabled).toBe(true);
  });

  it('should show result after submission', () => {
    const el = createDatePicker();
    const input = el.shadowRoot!.querySelector('.dp-input') as HTMLInputElement;
    input.value = '2024-06-15';
    input.dispatchEvent(new Event('change'));

    const btn = el.shadowRoot!.querySelector('.dp-submit') as HTMLElement;
    btn.click();

    const result = el.shadowRoot!.querySelector('.dp-result');
    expect(result).toBeTruthy();
    expect(result?.textContent).toContain('Selected:');
  });
});
