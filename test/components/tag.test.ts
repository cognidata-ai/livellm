import { describe, it, expect, beforeEach } from 'vitest';
import { LiveLLMTag, TAG_REGISTRATION } from '../../src/components/inline/tag';

const tagName = 'livellm-test-tag';
try { customElements.define(tagName, LiveLLMTag); } catch {}

function createTag(props: Record<string, any>): LiveLLMTag {
  const el = document.createElement(tagName) as LiveLLMTag;
  el.setAttribute('data-livellm', 'tag');
  el.setAttribute('data-props', JSON.stringify(props));
  document.body.appendChild(el);
  return el;
}

describe('Tag Component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should export registration with correct schema', () => {
    expect(TAG_REGISTRATION.schema.tags).toBeDefined();
    expect(TAG_REGISTRATION.schema.tags.required).toBe(true);
    expect(TAG_REGISTRATION.category).toBe('inline');
  });

  it('should render tags', () => {
    const el = createTag({
      tags: ['JavaScript', 'TypeScript', 'React'],
    });
    const shadow = el.shadowRoot!;
    const tags = shadow.querySelectorAll('.tag');
    expect(tags.length).toBe(3);
  });

  it('should render tag text', () => {
    const el = createTag({
      tags: ['Hello'],
    });
    const shadow = el.shadowRoot!;
    const tag = shadow.querySelector('.tag');
    expect(tag?.textContent).toContain('Hello');
  });

  it('should apply color when provided', () => {
    const el = createTag({
      tags: ['Status'],
      color: 'green',
    });
    const shadow = el.shadowRoot!;
    const tag = shadow.querySelector('.tag') as HTMLElement;
    expect(tag).toBeTruthy();
    // The color class or style should be applied
    const hasColor = tag.classList.contains('green') || tag.className.includes('green') || tag.getAttribute('style')?.includes('green');
    expect(hasColor).toBe(true);
  });

  it('should support outline variant', () => {
    const el = createTag({
      tags: ['Label'],
      variant: 'outline',
    });
    const shadow = el.shadowRoot!;
    const tag = shadow.querySelector('.tag') as HTMLElement;
    expect(tag).toBeTruthy();
  });

  it('should emit action when clickable', () => {
    const el = createTag({
      tags: ['Click Me'],
      clickable: true,
    });
    const shadow = el.shadowRoot!;
    let actionDetail: any = null;
    el.addEventListener('livellm:action', (e: Event) => {
      actionDetail = (e as CustomEvent).detail;
    });
    const tag = shadow.querySelector('.tag') as HTMLElement;
    tag?.click();
    expect(actionDetail).toBeTruthy();
    expect(actionDetail.action).toBe('tag-click');
  });
});
