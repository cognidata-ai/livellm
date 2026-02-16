import { describe, it, expect, beforeEach } from 'vitest';
import { LiveLLMAccordion, ACCORDION_REGISTRATION } from '../../src/components/block/accordion';

const tagName = 'livellm-test-accordion';
try { customElements.define(tagName, LiveLLMAccordion); } catch {}

function createAccordion(props: Record<string, any>): LiveLLMAccordion {
  const el = document.createElement(tagName) as LiveLLMAccordion;
  el.setAttribute('data-livellm', 'accordion');
  el.setAttribute('data-props', JSON.stringify(props));
  document.body.appendChild(el);
  return el;
}

describe('Accordion Component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should export registration with correct schema', () => {
    expect(ACCORDION_REGISTRATION.schema.items).toBeDefined();
    expect(ACCORDION_REGISTRATION.schema.sections).toBeDefined();
    expect(ACCORDION_REGISTRATION.schema.title).toBeDefined();
    expect(ACCORDION_REGISTRATION.category).toBe('block');
  });

  it('should render accordion with items prop', () => {
    const el = createAccordion({
      items: [
        { title: 'Section 1', content: 'Content 1' },
        { title: 'Section 2', content: 'Content 2' },
      ],
    });
    const shadow = el.shadowRoot!;
    const headers = shadow.querySelectorAll('.accordion-header');
    expect(headers.length).toBe(2);
    expect(headers[0].textContent).toContain('Section 1');
    expect(headers[1].textContent).toContain('Section 2');
  });

  it('should render accordion with sections prop (alias)', () => {
    const el = createAccordion({
      sections: [
        { title: 'Frontend (90%)', content: 'React components completos.' },
        { title: 'Backend (65%)', content: 'API REST implementada.' },
        { title: 'Testing (50%)', content: 'Unit tests del core.' },
      ],
    });
    const shadow = el.shadowRoot!;
    const headers = shadow.querySelectorAll('.accordion-header');
    expect(headers.length).toBe(3);
    expect(headers[0].textContent).toContain('Frontend (90%)');
    expect(headers[1].textContent).toContain('Backend (65%)');
    expect(headers[2].textContent).toContain('Testing (50%)');

    const bodies = shadow.querySelectorAll('.accordion-body');
    expect(bodies.length).toBe(3);
    expect(bodies[0].textContent).toContain('React components completos.');
  });

  it('should open first item by default (defaultOpen defaults to 0)', () => {
    const el = createAccordion({
      items: [
        { title: 'One', content: 'First' },
        { title: 'Two', content: 'Second' },
      ],
    });
    const shadow = el.shadowRoot!;
    const items = shadow.querySelectorAll('.accordion-item');
    expect(items[0].classList.contains('open')).toBe(true);
    expect(items[1].classList.contains('open')).toBe(false);
  });

  it('should open item on specified defaultOpen index', () => {
    const el = createAccordion({
      items: [
        { title: 'One', content: 'First' },
        { title: 'Two', content: 'Second' },
      ],
      defaultOpen: 1,
    });
    const shadow = el.shadowRoot!;
    const items = shadow.querySelectorAll('.accordion-item');
    expect(items[0].classList.contains('open')).toBe(false);
    expect(items[1].classList.contains('open')).toBe(true);
  });

  it('should toggle items on click', () => {
    const el = createAccordion({
      items: [
        { title: 'One', content: 'First' },
        { title: 'Two', content: 'Second' },
      ],
    });
    const shadow = el.shadowRoot!;
    const headers = shadow.querySelectorAll('.accordion-header');

    // First is already open by default, click second
    (headers[1] as HTMLElement).click();
    const items = shadow.querySelectorAll('.accordion-item');
    expect(items[0].classList.contains('open')).toBe(false);
    expect(items[1].classList.contains('open')).toBe(true);
  });

  it('should render empty accordion gracefully', () => {
    const el = createAccordion({});
    const shadow = el.shadowRoot!;
    const headers = shadow.querySelectorAll('.accordion-header');
    expect(headers.length).toBe(0);
    // Should still have the accordion container
    const accordion = shadow.querySelector('.accordion');
    expect(accordion).not.toBeNull();
  });

  it('should handle items with undefined/null title or content', () => {
    const el = createAccordion({
      items: [
        { title: undefined, content: 'Some content' },
        { title: 'Has title', content: null },
      ],
    });
    const shadow = el.shadowRoot!;
    const headers = shadow.querySelectorAll('.accordion-header');
    expect(headers.length).toBe(2);
    // Should not crash
  });

  it('should normalize item with alternative field names', () => {
    const el = createAccordion({
      items: [
        { label: 'From label', description: 'From desc' },
        { name: 'From name', body: 'From body' },
        { title: 'From title', text: 'From text' },
      ],
    });
    const shadow = el.shadowRoot!;
    const headers = shadow.querySelectorAll('.accordion-header');
    expect(headers[0].textContent).toContain('From label');
    expect(headers[1].textContent).toContain('From name');
    expect(headers[2].textContent).toContain('From title');

    const bodies = shadow.querySelectorAll('.accordion-body');
    expect(bodies[0].textContent).toContain('From desc');
    expect(bodies[1].textContent).toContain('From body');
    expect(bodies[2].textContent).toContain('From text');
  });

  it('should render title when provided', () => {
    const el = createAccordion({
      title: 'FAQ Section',
      items: [{ title: 'Q1', content: 'A1' }],
    });
    const shadow = el.shadowRoot!;
    const title = shadow.querySelector('.accordion-title');
    expect(title).not.toBeNull();
    expect(title!.textContent).toContain('FAQ Section');
  });

  it('should not render title when not provided', () => {
    const el = createAccordion({
      items: [{ title: 'Q1', content: 'A1' }],
    });
    const shadow = el.shadowRoot!;
    const title = shadow.querySelector('.accordion-title');
    expect(title).toBeNull();
  });

  it('should render in wrapper with livellm-component class', () => {
    const el = createAccordion({
      items: [{ title: 'Test', content: 'Body' }],
    });
    const shadow = el.shadowRoot!;
    const wrapper = shadow.querySelector('.livellm-component');
    expect(wrapper).not.toBeNull();
    const accordion = wrapper!.querySelector('.accordion');
    expect(accordion).not.toBeNull();
  });

  it('should handle string items gracefully', () => {
    const el = createAccordion({
      items: ['First', 'Second', 'Third'],
    });
    const shadow = el.shadowRoot!;
    const headers = shadow.querySelectorAll('.accordion-header');
    expect(headers.length).toBe(3);
    expect(headers[0].textContent).toContain('First');
  });
});
