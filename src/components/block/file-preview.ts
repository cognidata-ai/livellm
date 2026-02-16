import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';

const FILE_PREVIEW_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .fp-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    background: var(--livellm-bg-component, #ffffff);
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
    overflow: hidden;
  }
  .fp-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: var(--livellm-bg-secondary, #f8f9fa);
    border-bottom: 1px solid var(--livellm-border, #e0e0e0);
  }
  .fp-icon { font-size: 24px; }
  .fp-info { flex: 1; }
  .fp-filename {
    font-weight: 600;
    font-size: 14px;
    word-break: break-all;
  }
  .fp-meta {
    font-size: 12px;
    color: var(--livellm-text-secondary, #6c757d);
  }
  .fp-download {
    padding: 6px 14px;
    border-radius: 6px;
    border: 1px solid var(--livellm-border, #e0e0e0);
    background: var(--livellm-bg-component, #ffffff);
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    color: var(--livellm-primary, #6c5ce7);
    text-decoration: none;
    transition: var(--livellm-transition, 0.2s ease);
  }
  .fp-download:hover { background: rgba(108, 92, 231, 0.04); }
  .fp-preview {
    padding: 16px;
    max-height: 300px;
    overflow: auto;
  }
  .fp-code {
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    font-size: 13px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
    margin: 0;
    background: var(--livellm-bg-secondary, #f8f9fa);
    padding: 12px;
    border-radius: 6px;
  }
  .fp-image {
    max-width: 100%;
    display: block;
  }
`;

const FILE_ICONS: Record<string, string> = {
  pdf: '\uD83D\uDCC4', doc: '\uD83D\uDCC4', docx: '\uD83D\uDCC4',
  xls: '\uD83D\uDCCA', xlsx: '\uD83D\uDCCA', csv: '\uD83D\uDCCA',
  ppt: '\uD83D\uDCCA', pptx: '\uD83D\uDCCA',
  jpg: '\uD83D\uDDBC\uFE0F', jpeg: '\uD83D\uDDBC\uFE0F', png: '\uD83D\uDDBC\uFE0F', gif: '\uD83D\uDDBC\uFE0F', svg: '\uD83D\uDDBC\uFE0F',
  mp3: '\uD83C\uDFB5', wav: '\uD83C\uDFB5', ogg: '\uD83C\uDFB5',
  mp4: '\uD83C\uDFA5', webm: '\uD83C\uDFA5', avi: '\uD83C\uDFA5',
  zip: '\uD83D\uDCC1', rar: '\uD83D\uDCC1', tar: '\uD83D\uDCC1', gz: '\uD83D\uDCC1',
  js: '\uD83D\uDCDD', ts: '\uD83D\uDCDD', py: '\uD83D\uDCDD', rb: '\uD83D\uDCDD', go: '\uD83D\uDCDD',
  json: '\uD83D\uDCDD', yaml: '\uD83D\uDCDD', yml: '\uD83D\uDCDD', xml: '\uD83D\uDCDD',
  html: '\uD83C\uDF10', css: '\uD83C\uDF10',
  md: '\uD83D\uDCDD', txt: '\uD83D\uDCDD',
};

export class LiveLLMFilePreview extends LiveLLMComponent {
  render(): void {
    const filename: string = this._props.filename || 'file';
    const url: string = this._props.url || '';
    const size: string = this._props.size || '';
    const content: string = this._props.content || '';
    const language: string = this._props.language || '';

    this.setStyles(FILE_PREVIEW_STYLES);

    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const icon = FILE_ICONS[ext] || '\uD83D\uDCC4';
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext);

    let previewHtml = '';
    if (content) {
      previewHtml = `<div class="fp-preview"><pre class="fp-code">${this.escapeHtml(content)}</pre></div>`;
    } else if (isImage && url) {
      previewHtml = `<div class="fp-preview"><img class="fp-image" src="${this.escapeAttr(url)}" alt="${this.escapeAttr(filename)}" loading="lazy" /></div>`;
    }

    const metaParts = [ext.toUpperCase()];
    if (size) metaParts.push(size);
    if (language) metaParts.push(language);

    this.setContent(`
      <div class="fp-container">
        <div class="fp-header">
          <span class="fp-icon">${icon}</span>
          <div class="fp-info">
            <div class="fp-filename">${this.escapeHtml(filename)}</div>
            <div class="fp-meta">${metaParts.join(' \u2022 ')}</div>
          </div>
          ${url ? `<a class="fp-download" href="${this.escapeAttr(url)}" target="_blank" rel="noopener">Download</a>` : ''}
        </div>
        ${previewHtml}
      </div>
    `);
  }

  private escapeHtml(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  private escapeAttr(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export const FILE_PREVIEW_REGISTRATION: RegisterOptions = {
  schema: {
    filename: { type: 'string', required: true },
    url: { type: 'string', default: '' },
    size: { type: 'string', default: '' },
    content: { type: 'string', default: '' },
    language: { type: 'string', default: '' },
  },
  category: 'block',
  skeleton: {
    html: '<div style="height:80px;border-radius:8px;background:#e0e0e0;"></div>',
    height: '80px',
  },
};
