import { describe, it, expect, beforeEach } from 'vitest';
import { LiveLLMFilePreview, FILE_PREVIEW_REGISTRATION } from '../../src/components/block/file-preview';

const tagName = 'livellm-test-file-preview';
try { customElements.define(tagName, LiveLLMFilePreview); } catch {}

function createFilePreview(props: Record<string, any>): LiveLLMFilePreview {
  const el = document.createElement(tagName) as LiveLLMFilePreview;
  el.setAttribute('data-livellm', 'file-preview');
  el.setAttribute('data-props', JSON.stringify(props));
  document.body.appendChild(el);
  return el;
}

describe('File Preview Component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should export registration with correct schema', () => {
    expect(FILE_PREVIEW_REGISTRATION.schema.filename).toBeDefined();
    expect(FILE_PREVIEW_REGISTRATION.schema.filename.required).toBe(true);
    expect(FILE_PREVIEW_REGISTRATION.category).toBe('block');
  });

  it('should render filename', () => {
    const el = createFilePreview({
      filename: 'readme.md',
    });
    const shadow = el.shadowRoot!;
    const nameEl = shadow.querySelector('.fp-filename');
    expect(nameEl?.textContent).toContain('readme.md');
  });

  it('should render file size', () => {
    const el = createFilePreview({
      filename: 'data.json',
      size: '2.5 KB',
    });
    const shadow = el.shadowRoot!;
    const meta = shadow.querySelector('.fp-meta');
    expect(meta?.textContent).toContain('2.5 KB');
  });

  it('should render code content for text files', () => {
    const el = createFilePreview({
      filename: 'main.ts',
      content: 'const x = 1;',
      language: 'typescript',
    });
    const shadow = el.shadowRoot!;
    const code = shadow.querySelector('.fp-code, pre');
    expect(code?.textContent).toContain('const x = 1;');
  });

  it('should render download link when URL is provided', () => {
    const el = createFilePreview({
      filename: 'report.pdf',
      url: 'https://example.com/report.pdf',
    });
    const shadow = el.shadowRoot!;
    const link = shadow.querySelector('a[download], .fp-download');
    expect(link).toBeTruthy();
  });

  it('should show appropriate icon for different file types', () => {
    const el = createFilePreview({
      filename: 'image.png',
    });
    const shadow = el.shadowRoot!;
    const icon = shadow.querySelector('.fp-icon');
    expect(icon).toBeTruthy();
  });
});
