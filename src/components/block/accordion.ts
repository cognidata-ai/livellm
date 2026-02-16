import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';

const ACCORDION_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .accordion-title {
    font-size: 1.05em;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--livellm-text, #1a1a1a);
  }
  .accordion {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    overflow: hidden;
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
  }
  .accordion-item {
    border-bottom: 1px solid var(--livellm-border, #e0e0e0);
  }
  .accordion-item:last-child { border-bottom: none; }
  .accordion-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: var(--livellm-bg-component, #ffffff);
    cursor: pointer;
    user-select: none;
    font-weight: 500;
    transition: background 0.15s;
    min-height: 20px;
  }
  .accordion-header:hover {
    background: var(--livellm-bg-secondary, #f8f9fa);
  }
  .accordion-header-text {
    flex: 1;
    margin-right: 8px;
  }
  .accordion-arrow {
    transition: transform 0.2s;
    font-size: 12px;
    color: var(--livellm-text-secondary, #6c757d);
    flex-shrink: 0;
  }
  .accordion-item.open .accordion-arrow {
    transform: rotate(90deg);
  }
  .accordion-body {
    display: none;
    padding: 12px 16px;
    background: var(--livellm-bg, #ffffff);
    border-top: 1px solid var(--livellm-border, #e0e0e0);
    line-height: var(--livellm-line-height, 1.6);
    color: var(--livellm-text-secondary, #6c757d);
  }
  .accordion-item.open .accordion-body {
    display: block;
  }
`;

interface AccordionItem {
  title: string;
  content: string;
}

export class LiveLLMAccordion extends LiveLLMComponent {
  render(): void {
    const rawItems = this._props.items || this._props.sections || [];
    const items: AccordionItem[] = Array.isArray(rawItems)
      ? rawItems.map((item: any) => this.normalizeItem(item))
      : [];
    const exclusive = this._props.exclusive ?? true;
    const title = this._props.title || '';
    // Default to opening the first item if defaultOpen not specified
    const defaultOpen = this._props.defaultOpen ?? 0;

    this.setStyles(ACCORDION_STYLES);

    const titleHtml = title
      ? `<div class="accordion-title">${this.escapeHtml(title)}</div>`
      : '';

    const itemsHtml = items.map((item, i) => {
      const isOpen = defaultOpen === i ? ' open' : '';
      return `
        <div class="accordion-item${isOpen}" data-index="${i}">
          <div class="accordion-header">
            <span class="accordion-header-text">${this.escapeHtml(item.title)}</span>
            <span class="accordion-arrow">▶</span>
          </div>
          <div class="accordion-body">${this.escapeHtml(item.content)}</div>
        </div>`;
    }).join('');

    this.setContent(`${titleHtml}<div class="accordion">${itemsHtml}</div>`);

    this.shadowRoot?.querySelectorAll('.accordion-header').forEach((header) => {
      header.addEventListener('click', () => {
        const item = header.parentElement!;
        const idx = parseInt(item.getAttribute('data-index') || '0', 10);
        const wasOpen = item.classList.contains('open');

        if (exclusive) {
          this.shadowRoot?.querySelectorAll('.accordion-item').forEach((el) => {
            el.classList.remove('open');
          });
        }

        if (!wasOpen) {
          item.classList.add('open');
        }

        this.emitAction('toggle', {
          value: { index: idx, open: !wasOpen, title: items[idx]?.title },
          label: `${wasOpen ? 'Closed' : 'Opened'}: ${items[idx]?.title || ''}`,
        });
      });
    });
  }

  private normalizeItem(item: any): AccordionItem {
    if (!item || typeof item !== 'object') {
      return { title: String(item ?? ''), content: '' };
    }
    return {
      title: String(item.title ?? item.label ?? item.name ?? ''),
      content: String(item.content ?? item.body ?? item.description ?? item.text ?? ''),
    };
  }

  private escapeHtml(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export const ACCORDION_REGISTRATION: RegisterOptions = {
  schema: {
    items: { type: 'array' },
    sections: { type: 'array' },
    title: { type: 'string' },
    exclusive: { type: 'boolean', default: true },
    defaultOpen: { type: 'number', default: 0 },
  },
  category: 'block',
  skeleton: {
    html: '<div class="livellm-skeleton" style="height:150px;border-radius:8px;background:#f0f0f0;"><div class="shimmer"></div></div>',
    height: '150px',
  },
};
