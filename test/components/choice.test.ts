import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LiveLLMChoice } from '../../src/components/action/choice';

// Register the component once
const tagName = 'livellm-test-choice';
try { customElements.define(tagName, LiveLLMChoice); } catch {}

function createChoice(props: Record<string, any>): LiveLLMChoice {
  const el = document.createElement(tagName) as LiveLLMChoice;
  el.setAttribute('data-livellm', 'choice');
  el.setAttribute('data-props', JSON.stringify(props));
  document.body.appendChild(el);
  return el;
}

describe('Choice Component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should render question and options', () => {
    const el = createChoice({
      question: 'Pick a color',
      options: [
        { label: 'Red', value: 'red' },
        { label: 'Blue', value: 'blue' },
        { label: 'Green', value: 'green' },
      ],
    });

    const shadow = el.shadowRoot!;
    expect(shadow.querySelector('.choice-question')?.textContent).toContain('Pick a color');
    const options = shadow.querySelectorAll('.choice-option');
    expect(options.length).toBe(3);
  });

  it('should show radio indicators', () => {
    const el = createChoice({
      options: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }],
    });

    const radios = el.shadowRoot!.querySelectorAll('.choice-radio');
    expect(radios.length).toBe(2);
  });

  it('should emit action on selection', () => {
    const el = createChoice({
      question: 'Pick one',
      options: [
        { label: 'Option A', value: 'a' },
        { label: 'Option B', value: 'b' },
      ],
    });

    const actionHandler = vi.fn();
    el.addEventListener('livellm:action', (e) => {
      actionHandler((e as CustomEvent).detail);
    });

    const option = el.shadowRoot!.querySelector('[data-index="1"]') as HTMLElement;
    option.click();

    expect(actionHandler).toHaveBeenCalledTimes(1);
    expect(actionHandler.mock.calls[0][0].action).toBe('choice-select');
    expect(actionHandler.mock.calls[0][0].data.value).toBe('b');
  });

  it('should disable options after selection', () => {
    const el = createChoice({
      options: [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
      ],
    });

    const option = el.shadowRoot!.querySelector('[data-index="0"]') as HTMLElement;
    option.click();

    // After selection, options should be disabled
    const disabledOptions = el.shadowRoot!.querySelectorAll('.choice-option.disabled');
    expect(disabledOptions.length).toBe(2);
  });

  it('should mark the selected option', () => {
    const el = createChoice({
      options: [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
      ],
    });

    const option = el.shadowRoot!.querySelector('[data-index="1"]') as HTMLElement;
    option.click();

    const selected = el.shadowRoot!.querySelectorAll('.choice-option.selected');
    expect(selected.length).toBe(1);
  });

  it('should render option descriptions when provided', () => {
    const el = createChoice({
      options: [
        { label: 'A', value: 'a', description: 'First option' },
        { label: 'B', value: 'b', description: 'Second option' },
      ],
    });

    const descriptions = el.shadowRoot!.querySelectorAll('.choice-description');
    expect(descriptions.length).toBe(2);
    expect(descriptions[0].textContent).toContain('First option');
  });
});
