import { describe, it, expect, beforeEach } from 'vitest';
import { LiveLLMCounter, COUNTER_REGISTRATION } from '../../src/components/inline/counter';

const tagName = 'livellm-test-counter';
try { customElements.define(tagName, LiveLLMCounter); } catch {}

function createCounter(props: Record<string, any>): LiveLLMCounter {
  const el = document.createElement(tagName) as LiveLLMCounter;
  el.setAttribute('data-livellm', 'counter');
  el.setAttribute('data-props', JSON.stringify(props));
  document.body.appendChild(el);
  return el;
}

describe('Counter Component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should export registration with correct schema', () => {
    expect(COUNTER_REGISTRATION.schema.value).toBeDefined();
    expect(COUNTER_REGISTRATION.schema.value.required).toBe(true);
    expect(COUNTER_REGISTRATION.category).toBe('inline');
  });

  it('should render formatted number', () => {
    const el = createCounter({
      value: 1234,
    });
    const shadow = el.shadowRoot!;
    const valueEl = shadow.querySelector('.counter-value');
    expect(valueEl?.textContent).toContain('1');
    expect(valueEl?.textContent).toContain('234');
  });

  it('should render compact format', () => {
    const el = createCounter({
      value: 1500000,
      format: 'compact',
    });
    const shadow = el.shadowRoot!;
    const valueEl = shadow.querySelector('.counter-value');
    expect(valueEl?.textContent).toContain('1.5M');
  });

  it('should render compact K format', () => {
    const el = createCounter({
      value: 2500,
      format: 'compact',
    });
    const shadow = el.shadowRoot!;
    const valueEl = shadow.querySelector('.counter-value');
    expect(valueEl?.textContent).toContain('2.5K');
  });

  it('should render percent format', () => {
    const el = createCounter({
      value: 95,
      format: 'percent',
    });
    const shadow = el.shadowRoot!;
    const suffix = shadow.querySelector('.counter-suffix');
    expect(suffix?.textContent).toContain('%');
  });

  it('should render label', () => {
    const el = createCounter({
      value: 42,
      label: 'Users',
    });
    const shadow = el.shadowRoot!;
    const label = shadow.querySelector('.counter-label');
    expect(label?.textContent).toContain('Users');
  });

  it('should render prefix', () => {
    const el = createCounter({
      value: 99,
      prefix: '$',
    });
    const shadow = el.shadowRoot!;
    const prefix = shadow.querySelector('.counter-suffix');
    expect(prefix?.textContent).toContain('$');
  });

  it('should render suffix', () => {
    const el = createCounter({
      value: 100,
      suffix: 'pts',
    });
    const shadow = el.shadowRoot!;
    const suffixes = shadow.querySelectorAll('.counter-suffix');
    const haspts = Array.from(suffixes).some(s => s.textContent?.includes('pts'));
    expect(haspts).toBe(true);
  });
});
