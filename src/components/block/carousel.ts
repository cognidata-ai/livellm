import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';

const CAROUSEL_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .carousel-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    overflow: hidden;
    background: var(--livellm-bg-component, #ffffff);
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
    position: relative;
  }
  .carousel-track {
    display: flex;
    transition: transform 0.3s ease;
  }
  .carousel-slide {
    min-width: 100%;
    box-sizing: border-box;
    padding: 20px;
  }
  .carousel-slide-title {
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 8px;
  }
  .carousel-slide-content {
    font-size: 14px;
    line-height: var(--livellm-line-height, 1.6);
    color: var(--livellm-text-secondary, #6c757d);
  }
  .carousel-slide img {
    max-width: 100%;
    border-radius: 6px;
    margin-bottom: 10px;
  }
  .carousel-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    border-top: 1px solid var(--livellm-border, #e0e0e0);
    background: var(--livellm-bg-secondary, #f8f9fa);
  }
  .carousel-btn {
    padding: 6px 14px;
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: 6px;
    background: var(--livellm-bg-component, #ffffff);
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    color: var(--livellm-text, #1a1a1a);
    transition: var(--livellm-transition, 0.2s ease);
  }
  .carousel-btn:hover { background: var(--livellm-bg-secondary, #f8f9fa); border-color: var(--livellm-primary, #6c5ce7); }
  .carousel-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .carousel-dots {
    display: flex;
    gap: 6px;
  }
  .carousel-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--livellm-border, #e0e0e0);
    border: none;
    cursor: pointer;
    padding: 0;
    transition: var(--livellm-transition, 0.2s ease);
  }
  .carousel-dot.active { background: var(--livellm-primary, #6c5ce7); }
`;

interface Slide {
  title?: string;
  content: string;
  image?: string;
}

export class LiveLLMCarousel extends LiveLLMComponent {
  private currentSlide: number = 0;

  render(): void {
    const rawSlides = this._props.slides || this._props.items || this._props.cards || this._props.pages || [];
    const slides: Slide[] = Array.isArray(rawSlides)
      ? rawSlides.map((s: any) => this.normalizeSlide(s))
      : [];
    const loop: boolean = this._props.loop ?? false;

    this.setStyles(CAROUSEL_STYLES);

    const slidesHtml = slides.map(slide => `
      <div class="carousel-slide">
        ${slide.image ? `<img src="${this.escapeAttr(slide.image)}" alt="${this.escapeAttr(slide.title || '')}" loading="lazy" />` : ''}
        ${slide.title ? `<div class="carousel-slide-title">${this.escapeHtml(slide.title)}</div>` : ''}
        <div class="carousel-slide-content">${this.escapeHtml(slide.content)}</div>
      </div>
    `).join('');

    const dotsHtml = slides.map((_, i) =>
      `<button class="carousel-dot${i === this.currentSlide ? ' active' : ''}" data-slide="${i}"></button>`
    ).join('');

    const canPrev = loop || this.currentSlide > 0;
    const canNext = loop || this.currentSlide < slides.length - 1;

    this.setContent(`
      <div class="carousel-container">
        <div class="carousel-track" style="transform:translateX(-${this.currentSlide * 100}%)">
          ${slidesHtml}
        </div>
        <div class="carousel-nav">
          <button class="carousel-btn" data-dir="prev" ${!canPrev ? 'disabled' : ''}>\u2190 Prev</button>
          <div class="carousel-dots">${dotsHtml}</div>
          <button class="carousel-btn" data-dir="next" ${!canNext ? 'disabled' : ''}>Next \u2192</button>
        </div>
      </div>
    `);

    this.shadowRoot?.querySelector('[data-dir="prev"]')?.addEventListener('click', () => this.navigate(-1, slides.length, loop));
    this.shadowRoot?.querySelector('[data-dir="next"]')?.addEventListener('click', () => this.navigate(1, slides.length, loop));
    this.shadowRoot?.querySelectorAll('.carousel-dot').forEach(dot => {
      dot.addEventListener('click', (e) => {
        this.currentSlide = parseInt((e.currentTarget as HTMLElement).getAttribute('data-slide') || '0', 10);
        this.render();
      });
    });
  }

  private navigate(dir: number, total: number, loop: boolean): void {
    let next = this.currentSlide + dir;
    if (loop) {
      next = (next + total) % total;
    } else {
      next = Math.max(0, Math.min(total - 1, next));
    }
    this.currentSlide = next;
    this.render();

    this.emitAction('carousel-navigate', {
      value: this.currentSlide,
      label: `Slide ${this.currentSlide + 1} of ${total}`,
    });
  }

  private normalizeSlide(slide: any): Slide {
    if (typeof slide === 'string') {
      return { content: slide };
    }
    if (!slide || typeof slide !== 'object') {
      return { content: String(slide ?? '') };
    }
    return {
      title: slide.title ?? slide.label ?? slide.name ?? undefined,
      content: String(slide.content ?? slide.body ?? slide.text ?? slide.description ?? ''),
      image: slide.image ?? slide.img ?? slide.src ?? undefined,
    };
  }

  private escapeHtml(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  private escapeAttr(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export const CAROUSEL_REGISTRATION: RegisterOptions = {
  schema: {
    slides: { type: 'array' },
    items: { type: 'array' },
    cards: { type: 'array' },
    pages: { type: 'array' },
    loop: { type: 'boolean', default: false },
  },
  category: 'block',
  skeleton: {
    html: '<div style="height:200px;border-radius:8px;background:#e0e0e0;"></div>',
    height: '200px',
  },
};
