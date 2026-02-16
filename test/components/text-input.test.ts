import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LiveLLMTextInput } from '../../src/components/action/text-input';

const tagName = 'livellm-test-text-input';
try { customElements.define(tagName, LiveLLMTextInput); } catch {}

function createTextInput(props: Record<string, any> = {}): LiveLLMTextInput {
  const el = document.createElement(tagName) as LiveLLMTextInput;
  el.setAttribute('data-livellm', 'text-input');
  el.setAttribute('data-props', JSON.stringify(props));
  document.body.appendChild(el);
  return el;
}

describe('Text Input Component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should render label and input', () => {
    const el = createTextInput({ label: 'Your feedback' });
    expect(el.shadowRoot!.querySelector('.ti-label')?.textContent).toContain('Your feedback');
    expect(el.shadowRoot!.querySelector('.ti-input')).toBeTruthy();
  });

  it('should render textarea for multiline', () => {
    const el = createTextInput({ multiline: true });
    expect(el.shadowRoot!.querySelector('.ti-textarea')).toBeTruthy();
    expect(el.shadowRoot!.querySelector('.ti-input')).toBeFalsy();
  });

  it('should render placeholder', () => {
    const el = createTextInput({ placeholder: 'Type here...' });
    const input = el.shadowRoot!.querySelector('.ti-input') as HTMLInputElement;
    expect(input.placeholder).toBe('Type here...');
  });

  it('should render hint text', () => {
    const el = createTextInput({ hint: 'Please be specific' });
    expect(el.shadowRoot!.querySelector('.ti-hint')?.textContent).toContain('Please be specific');
  });

  it('should show character count when maxLength is set', () => {
    const el = createTextInput({ maxLength: 200 });
    expect(el.shadowRoot!.querySelector('.ti-char-count')?.textContent).toContain('/200');
  });

  it('should have a submit button', () => {
    const el = createTextInput();
    expect(el.shadowRoot!.querySelector('.ti-submit')).toBeTruthy();
  });

  it('should emit action on submit after input', () => {
    const el = createTextInput({ label: 'Comment' });
    const handler = vi.fn();
    el.addEventListener('livellm:action', (e) => handler((e as CustomEvent).detail));

    // Simulate typing
    const input = el.shadowRoot!.querySelector('.ti-input') as HTMLInputElement;
    input.value = 'Great response!';
    input.dispatchEvent(new Event('input'));

    // Click submit
    const btn = el.shadowRoot!.querySelector('.ti-submit') as HTMLElement;
    btn.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].action).toBe('text-submit');
    expect(handler.mock.calls[0][0].data.value).toBe('Great response!');
  });

  it('should not submit empty text', () => {
    const el = createTextInput();
    const handler = vi.fn();
    el.addEventListener('livellm:action', (e) => handler((e as CustomEvent).detail));

    const btn = el.shadowRoot!.querySelector('.ti-submit') as HTMLElement;
    btn.click();

    expect(handler).not.toHaveBeenCalled();
  });

  it('should disable input after submission', () => {
    const el = createTextInput();
    const input = el.shadowRoot!.querySelector('.ti-input') as HTMLInputElement;
    input.value = 'test';
    input.dispatchEvent(new Event('input'));

    const btn = el.shadowRoot!.querySelector('.ti-submit') as HTMLElement;
    btn.click();

    const disabledInput = el.shadowRoot!.querySelector('.ti-input') as HTMLInputElement;
    expect(disabledInput.disabled).toBe(true);
  });
});
