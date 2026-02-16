import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';

const TABS_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .tabs-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    overflow: hidden;
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
  }
  .tabs-header {
    display: flex;
    background: var(--livellm-bg-secondary, #f8f9fa);
    border-bottom: 1px solid var(--livellm-border, #e0e0e0);
    overflow-x: auto;
  }
  .tab-button {
    flex-shrink: 0;
    padding: 10px 20px;
    border: none;
    background: transparent;
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    color: var(--livellm-text-secondary, #6c757d);
    border-bottom: 2px solid transparent;
    transition: var(--livellm-transition, 0.2s ease);
    white-space: nowrap;
  }
  .tab-button:hover {
    color: var(--livellm-text, #1a1a1a);
    background: rgba(0, 0, 0, 0.03);
  }
  .tab-button.active {
    color: var(--livellm-primary, #6c5ce7);
    border-bottom-color: var(--livellm-primary, #6c5ce7);
    font-weight: 600;
  }
  .tab-panel {
    display: none;
    padding: 16px;
    line-height: var(--livellm-line-height, 1.6);
    background: var(--livellm-bg-component, #ffffff);
  }
  .tab-panel.active {
    display: block;
  }
`;

interface TabData {
  label: string;
  content: string;
}

export class LiveLLMTabs extends LiveLLMComponent {
  private activeTab: number = 0;

  render(): void {
    const rawTabs = this._props.tabs || this._props.items || this._props.sections || this._props.panels || [];
    const tabs: TabData[] = Array.isArray(rawTabs)
      ? rawTabs.map((t: any) => this.normalizeTab(t))
      : [];
    const defaultTab = this._props.defaultTab ?? 0;
    this.activeTab = defaultTab;

    this.setStyles(TABS_STYLES);

    const headerButtons = tabs
      .map(
        (tab, i) =>
          `<button class="tab-button${i === this.activeTab ? ' active' : ''}" data-tab-index="${i}">${this.escapeHtml(tab.label)}</button>`
      )
      .join('');

    const panels = tabs
      .map(
        (tab, i) =>
          `<div class="tab-panel${i === this.activeTab ? ' active' : ''}" data-tab-panel="${i}">${this.escapeHtml(tab.content)}</div>`
      )
      .join('');

    this.setContent(`
      <div class="tabs-container">
        <div class="tabs-header">${headerButtons}</div>
        ${panels}
      </div>
    `);

    // Add click listeners
    this.shadowRoot?.querySelectorAll('.tab-button').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const index = parseInt(target.getAttribute('data-tab-index') || '0', 10);
        this.switchTab(index);
      });
    });
  }

  private switchTab(index: number): void {
    if (!this.shadowRoot) return;

    this.activeTab = index;

    // Update buttons
    this.shadowRoot.querySelectorAll('.tab-button').forEach((btn, i) => {
      btn.classList.toggle('active', i === index);
    });

    // Update panels
    this.shadowRoot.querySelectorAll('.tab-panel').forEach((panel, i) => {
      panel.classList.toggle('active', i === index);
    });

    const rawTabs = this._props.tabs || this._props.items || this._props.sections || this._props.panels || [];
    const tabs: TabData[] = Array.isArray(rawTabs) ? rawTabs.map((t: any) => this.normalizeTab(t)) : [];
    const tab = tabs[index];
    if (tab) {
      this.emitAction('tab-switch', {
        value: { index, label: tab.label },
        label: `Switched to tab: ${tab.label}`,
      });
    }
  }

  private normalizeTab(tab: any): TabData {
    if (typeof tab === 'string') {
      return { label: tab, content: tab };
    }
    if (!tab || typeof tab !== 'object') {
      return { label: String(tab ?? ''), content: '' };
    }
    return {
      label: String(tab.label ?? tab.title ?? tab.name ?? tab.header ?? ''),
      content: String(tab.content ?? tab.body ?? tab.text ?? tab.description ?? ''),
    };
  }

  private escapeHtml(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export const TABS_REGISTRATION: RegisterOptions = {
  schema: {
    tabs: { type: 'array' },
    items: { type: 'array' },
    sections: { type: 'array' },
    panels: { type: 'array' },
    defaultTab: { type: 'number', default: 0, min: 0 },
  },
  category: 'block',
  skeleton: {
    html: '<div style="height:150px;border-radius:8px;background:#e0e0e0;"></div>',
    height: '150px',
  },
};
