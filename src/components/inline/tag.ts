import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';

const TAG_STYLES = `
  :host {
    display: inline-flex;
    vertical-align: middle;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    display: inline-flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .tag {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.4;
    transition: var(--livellm-transition, 0.2s ease);
  }
  .tag-icon { margin-right: 4px; }
  .tag.clickable { cursor: pointer; }
  .tag.clickable:hover { opacity: 0.8; transform: scale(1.02); }
  /* Colors */
  .tag.blue { background: #dbeafe; color: #1e40af; }
  .tag.green { background: #dcfce7; color: #166534; }
  .tag.red { background: #fef2f2; color: #991b1b; }
  .tag.yellow { background: #fefce8; color: #854d0e; }
  .tag.purple { background: #f3e8ff; color: #6b21a8; }
  .tag.gray { background: #f3f4f6; color: #374151; }
  .tag.orange { background: #fff7ed; color: #9a3412; }
  .tag.pink { background: #fdf2f8; color: #9d174d; }
  .tag.outline {
    background: transparent;
    border: 1px solid currentColor;
  }
`;

interface TagItem {
  text: string;
  color?: string;
  icon?: string;
}

export class LiveLLMTag extends LiveLLMComponent {
  render(): void {
    const tags: TagItem[] | string[] = this._props.tags || [];
    const variant: string = this._props.variant || 'solid';
    const clickable: boolean = this._props.clickable ?? false;
    const defaultColor: string = this._props.color || 'blue';

    this.setStyles(TAG_STYLES);

    const tagsHtml = tags.map((tag, i) => {
      const item = typeof tag === 'string' ? { text: tag } : tag;
      const color = item.color || defaultColor;
      const classes = ['tag', color];
      if (variant === 'outline') classes.push('outline');
      if (clickable) classes.push('clickable');

      return `<span class="${classes.join(' ')}" data-index="${i}">
        ${item.icon ? `<span class="tag-icon">${this.escapeHtml(item.icon)}</span>` : ''}
        ${this.escapeHtml(item.text)}
      </span>`;
    }).join('');

    this.setContent(tagsHtml);

    if (clickable) {
      this.shadowRoot?.querySelectorAll('.tag').forEach(tag => {
        tag.addEventListener('click', (e) => {
          const idx = parseInt((e.currentTarget as HTMLElement).getAttribute('data-index') || '0', 10);
          const item = tags[idx];
          const text = typeof item === 'string' ? item : item.text;
          this.emitAction('tag-click', {
            value: text,
            label: `Clicked tag: ${text}`,
            index: idx,
          });
        });
      });
    }
  }

  private escapeHtml(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export const TAG_REGISTRATION: RegisterOptions = {
  schema: {
    tags: { type: 'array', required: true },
    color: { type: 'string', default: 'blue' },
    variant: { type: 'string', default: 'solid' },
    clickable: { type: 'boolean', default: false },
  },
  category: 'inline',
  skeleton: {
    html: '<span style="display:inline-block;width:80px;height:20px;background:#e0e0e0;border-radius:12px;"></span>',
    height: '20px',
  },
};
