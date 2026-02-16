import { describe, it, expect, beforeEach } from 'vitest';
import { LiveLLMLinkPreview, LINK_PREVIEW_REGISTRATION } from '../../src/components/block/link-preview';

const tagName = 'livellm-test-link-preview';
try { customElements.define(tagName, LiveLLMLinkPreview); } catch {}

function createLinkPreview(props: Record<string, any>): LiveLLMLinkPreview {
  const el = document.createElement(tagName) as LiveLLMLinkPreview;
  el.setAttribute('data-livellm', 'link-preview');
  el.setAttribute('data-props', JSON.stringify(props));
  document.body.appendChild(el);
  return el;
}

describe('Link Preview Component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should export registration with correct schema', () => {
    expect(LINK_PREVIEW_REGISTRATION.schema.url).toBeDefined();
    expect(LINK_PREVIEW_REGISTRATION.schema.url.required).toBe(true);
    expect(LINK_PREVIEW_REGISTRATION.category).toBe('block');
  });

  it('should render a link with the correct URL', () => {
    const el = createLinkPreview({
      url: 'https://github.com/test/repo',
      title: 'Test Repo',
    });
    const shadow = el.shadowRoot!;
    const link = shadow.querySelector('a') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.href).toContain('github.com/test/repo');
    expect(link.target).toBe('_blank');
  });

  it('should render title', () => {
    const el = createLinkPreview({
      url: 'https://example.com',
      title: 'Example Site',
    });
    const shadow = el.shadowRoot!;
    const title = shadow.querySelector('.lp-title');
    expect(title?.textContent).toContain('Example Site');
  });

  it('should render description when provided', () => {
    const el = createLinkPreview({
      url: 'https://example.com',
      title: 'Example',
      description: 'This is an example site',
    });
    const shadow = el.shadowRoot!;
    const desc = shadow.querySelector('.lp-description');
    expect(desc?.textContent).toContain('This is an example site');
  });

  it('should extract domain from URL', () => {
    const el = createLinkPreview({
      url: 'https://www.github.com/user/repo',
      title: 'Repo',
    });
    const shadow = el.shadowRoot!;
    const domain = shadow.querySelector('.lp-domain');
    expect(domain?.textContent).toContain('github.com');
  });

  it('should render domain icon for known sites', () => {
    const el = createLinkPreview({
      url: 'https://github.com/user/repo',
      title: 'Repo',
    });
    const shadow = el.shadowRoot!;
    const icon = shadow.querySelector('.lp-domain-icon');
    expect(icon).toBeTruthy();
  });

  it('should render image when provided', () => {
    const el = createLinkPreview({
      url: 'https://example.com',
      title: 'Example',
      image: 'https://example.com/og-image.jpg',
    });
    const shadow = el.shadowRoot!;
    const img = shadow.querySelector('.lp-image img');
    expect(img).toBeTruthy();
  });
});
