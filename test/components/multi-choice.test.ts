import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LiveLLMMultiChoice } from '../../src/components/action/multi-choice';

const tagName = 'livellm-test-multi-choice';
try { customElements.define(tagName, LiveLLMMultiChoice); } catch {}

function createMultiChoice(props: Record<string, any>): LiveLLMMultiChoice {
  const el = document.createElement(tagName) as LiveLLMMultiChoice;
  el.setAttribute('data-livellm', 'multi-choice');
  el.setAttribute('data-props', JSON.stringify(props));
  document.body.appendChild(el);
  return el;
}

describe('Multi-Choice Component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should render question and checkboxes', () => {
    const el = createMultiChoice({
      question: 'Select skills',
      options: [
        { label: 'JavaScript', value: 'js' },
        { label: 'Python', value: 'py' },
        { label: 'Go', value: 'go' },
      ],
    });

    const shadow = el.shadowRoot!;
    expect(shadow.querySelector('.mc-question')?.textContent).toContain('Select skills');
    expect(shadow.querySelectorAll('.mc-option').length).toBe(3);
    expect(shadow.querySelectorAll('.mc-checkbox').length).toBe(3);
  });

  it('should show submit button', () => {
    const el = createMultiChoice({
      options: [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
      ],
    });

    expect(el.shadowRoot!.querySelector('.mc-submit')).toBeTruthy();
  });

  it('should toggle option selection on click', () => {
    const el = createMultiChoice({
      options: [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
        { label: 'C', value: 'c' },
      ],
      max: 3,
    });

    const options = el.shadowRoot!.querySelectorAll('.mc-option');
    (options[0] as HTMLElement).click();
    (options[2] as HTMLElement).click();

    const selected = el.shadowRoot!.querySelectorAll('.mc-option.selected');
    expect(selected.length).toBe(2);
  });

  it('should emit action with selected values on submit', () => {
    const el = createMultiChoice({
      question: 'Pick any',
      options: [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
        { label: 'C', value: 'c' },
      ],
      max: 3,
    });

    const handler = vi.fn();
    el.addEventListener('livellm:action', (e) => handler((e as CustomEvent).detail));

    const options = el.shadowRoot!.querySelectorAll('.mc-option');
    (options[0] as HTMLElement).click();
    (options[2] as HTMLElement).click();

    const submitBtn = el.shadowRoot!.querySelector('.mc-submit') as HTMLElement;
    submitBtn.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].action).toBe('multi-choice-submit');
    expect(handler.mock.calls[0][0].data.value).toEqual(['a', 'c']);
  });

  it('should show hint with min/max', () => {
    const el = createMultiChoice({
      options: [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
        { label: 'C', value: 'c' },
      ],
      min: 1,
      max: 2,
    });

    const hint = el.shadowRoot!.querySelector('.mc-hint');
    expect(hint?.textContent).toContain('1-2');
  });

  it('should disable options after submission', () => {
    const el = createMultiChoice({
      options: [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
      ],
      min: 1,
      max: 2,
    });

    const options = el.shadowRoot!.querySelectorAll('.mc-option');
    (options[0] as HTMLElement).click();

    const submitBtn = el.shadowRoot!.querySelector('.mc-submit') as HTMLElement;
    submitBtn.click();

    const disabled = el.shadowRoot!.querySelectorAll('.mc-option.disabled');
    expect(disabled.length).toBe(2);
  });
});
