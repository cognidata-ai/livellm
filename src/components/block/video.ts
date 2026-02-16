import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';

const VIDEO_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .video-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    overflow: hidden;
    background: #000;
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
  }
  .video-wrapper {
    position: relative;
    width: 100%;
    padding-bottom: 56.25%; /* 16:9 */
  }
  .video-wrapper iframe, .video-wrapper video {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;
  }
  .video-caption {
    padding: 10px 14px;
    font-size: 13px;
    color: var(--livellm-text-secondary, #6c757d);
    background: var(--livellm-bg-component, #ffffff);
    border-top: 1px solid var(--livellm-border, #e0e0e0);
  }
  .video-error {
    padding: 40px 20px;
    text-align: center;
    color: var(--livellm-text-secondary, #6c757d);
    background: var(--livellm-bg-secondary, #f8f9fa);
  }
`;

export class LiveLLMVideo extends LiveLLMComponent {
  render(): void {
    const url: string = this._props.url || '';
    const caption: string = this._props.caption || '';
    const autoplay: boolean = this._props.autoplay ?? false;

    this.setStyles(VIDEO_STYLES);

    const embedUrl = this.getEmbedUrl(url);

    let videoHtml: string;
    if (embedUrl) {
      const autoplayParam = autoplay ? '&autoplay=1' : '';
      videoHtml = `
        <div class="video-wrapper">
          <iframe src="${this.escapeAttr(embedUrl)}${autoplayParam}"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen loading="lazy"></iframe>
        </div>
      `;
    } else if (url && (url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.ogg'))) {
      videoHtml = `
        <div class="video-wrapper">
          <video controls ${autoplay ? 'autoplay muted' : ''} preload="metadata">
            <source src="${this.escapeAttr(url)}">
            Your browser does not support the video tag.
          </video>
        </div>
      `;
    } else {
      videoHtml = `<div class="video-error">Unable to embed video: ${this.escapeHtml(url || 'No URL provided')}</div>`;
    }

    this.setContent(`
      <div class="video-container">
        ${videoHtml}
        ${caption ? `<div class="video-caption">${this.escapeHtml(caption)}</div>` : ''}
      </div>
    `);
  }

  private getEmbedUrl(url: string): string | null {
    try {
      const u = new URL(url);
      // YouTube
      if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
        let videoId = '';
        if (u.hostname.includes('youtu.be')) {
          videoId = u.pathname.slice(1);
        } else {
          videoId = u.searchParams.get('v') || '';
        }
        if (videoId) return `https://www.youtube.com/embed/${videoId}`;
      }
      // Vimeo
      if (u.hostname.includes('vimeo.com')) {
        const id = u.pathname.split('/').pop();
        if (id) return `https://player.vimeo.com/video/${id}`;
      }
    } catch {}
    return null;
  }

  private escapeHtml(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private escapeAttr(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export const VIDEO_REGISTRATION: RegisterOptions = {
  schema: {
    url: { type: 'string', required: true },
    caption: { type: 'string', default: '' },
    autoplay: { type: 'boolean', default: false },
  },
  category: 'block',
  skeleton: {
    html: '<div style="height:300px;border-radius:8px;background:#1a1a1a;"></div>',
    height: '300px',
  },
};
