import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';

const LINK_PREVIEW_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .lp-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    background: var(--livellm-bg-component, #ffffff);
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
    overflow: hidden;
    display: flex;
    cursor: pointer;
    transition: var(--livellm-transition, 0.2s ease);
    text-decoration: none;
    color: inherit;
  }
  .lp-container:hover {
    border-color: var(--livellm-primary, #6c5ce7);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  .lp-image {
    width: 120px;
    min-height: 90px;
    background: var(--livellm-bg-secondary, #f8f9fa);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
    overflow: hidden;
  }
  .lp-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .lp-content {
    padding: 12px 16px;
    flex: 1;
    min-width: 0;
  }
  .lp-title {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .lp-description {
    font-size: 13px;
    color: var(--livellm-text-secondary, #6c757d);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin-bottom: 6px;
  }
  .lp-domain {
    font-size: 11px;
    color: var(--livellm-text-secondary, #6c757d);
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .lp-domain-icon {
    width: 14px;
    height: 14px;
  }
`;

const DOMAIN_ICONS: Record<string, string> = {
  'github.com': '\uD83D\uDC19',
  'stackoverflow.com': '\uD83D\uDCDA',
  'youtube.com': '\u25B6\uFE0F',
  'youtu.be': '\u25B6\uFE0F',
  'twitter.com': '\uD83D\uDC26',
  'x.com': '\uD83D\uDC26',
  'reddit.com': '\uD83E\uDD16',
  'wikipedia.org': '\uD83D\uDCDA',
  'medium.com': '\u270D\uFE0F',
  'dev.to': '\uD83D\uDC68\u200D\uD83D\uDCBB',
  'npmjs.com': '\uD83D\uDCE6',
};

export class LiveLLMLinkPreview extends LiveLLMComponent {
  render(): void {
    const url: string = this._props.url || '';
    const title: string = this._props.title || url;
    const description: string = this._props.description || '';
    const image: string = this._props.image || '';
    const domain: string = this._props.domain || this.getDomain(url);

    this.setStyles(LINK_PREVIEW_STYLES);

    const icon = DOMAIN_ICONS[domain] || '\uD83C\uDF10';
    const imageHtml = image
      ? `<img src="${this.escapeAttr(image)}" alt="" loading="lazy" />`
      : icon;

    this.setContent(`
      <a class="lp-container" href="${this.escapeAttr(url)}" target="_blank" rel="noopener noreferrer">
        <div class="lp-image">${imageHtml}</div>
        <div class="lp-content">
          <div class="lp-title">${this.escapeHtml(title)}</div>
          ${description ? `<div class="lp-description">${this.escapeHtml(description)}</div>` : ''}
          <div class="lp-domain"><span class="lp-domain-icon">${icon}</span>${this.escapeHtml(domain)}</div>
        </div>
      </a>
    `);
  }

  private getDomain(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  private escapeHtml(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  private escapeAttr(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export const LINK_PREVIEW_REGISTRATION: RegisterOptions = {
  schema: {
    url: { type: 'string', required: true },
    title: { type: 'string', default: '' },
    description: { type: 'string', default: '' },
    image: { type: 'string', default: '' },
    domain: { type: 'string', default: '' },
  },
  category: 'block',
  skeleton: {
    html: '<div style="height:90px;border-radius:8px;background:#e0e0e0;"></div>',
    height: '90px',
  },
};
