import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LiveLLMFileUpload } from '../../src/components/action/file-upload';

const tagName = 'livellm-test-file-upload';
try { customElements.define(tagName, LiveLLMFileUpload); } catch {}

function createFileUpload(props: Record<string, any> = {}): LiveLLMFileUpload {
  const el = document.createElement(tagName) as LiveLLMFileUpload;
  el.setAttribute('data-livellm', 'file-upload');
  el.setAttribute('data-props', JSON.stringify(props));
  document.body.appendChild(el);
  return el;
}

describe('File Upload Component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should render label and dropzone', () => {
    const el = createFileUpload({ label: 'Upload your file' });
    expect(el.shadowRoot!.querySelector('.fu-label')?.textContent).toContain('Upload your file');
    expect(el.shadowRoot!.querySelector('.fu-dropzone')).toBeTruthy();
  });

  it('should render hidden file input', () => {
    const el = createFileUpload();
    const input = el.shadowRoot!.querySelector('.fu-file-input') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.type).toBe('file');
  });

  it('should set accept attribute', () => {
    const el = createFileUpload({ accept: '.pdf,.doc' });
    const input = el.shadowRoot!.querySelector('.fu-file-input') as HTMLInputElement;
    expect(input.accept).toBe('.pdf,.doc');
  });

  it('should show size hint', () => {
    const el = createFileUpload({ maxSizeMB: 5 });
    const hint = el.shadowRoot!.querySelector('.fu-hint');
    expect(hint?.textContent).toContain('Max size: 5MB');
  });

  it('should render browse text in dropzone', () => {
    const el = createFileUpload();
    const text = el.shadowRoot!.querySelector('.fu-text');
    expect(text?.textContent).toContain('Click to browse');
  });

  it('should show accept hint when specified', () => {
    const el = createFileUpload({ accept: '.pdf,.doc', maxSizeMB: 10 });
    const hint = el.shadowRoot!.querySelector('.fu-hint');
    expect(hint?.textContent).toContain('Accepted: .pdf,.doc');
  });
});
