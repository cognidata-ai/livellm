import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';

const TIMELINE_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .timeline-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    padding: 20px;
    background: var(--livellm-bg-component, #ffffff);
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
  }
  .timeline-title {
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 16px;
  }
  .timeline-item {
    display: flex;
    gap: 14px;
    position: relative;
    padding-bottom: 20px;
  }
  .timeline-item:last-child { padding-bottom: 0; }
  .timeline-marker-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
  }
  .timeline-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--livellm-primary, #6c5ce7);
    border: 2px solid var(--livellm-bg-component, #ffffff);
    box-shadow: 0 0 0 2px var(--livellm-primary, #6c5ce7);
    z-index: 1;
    flex-shrink: 0;
  }
  .timeline-line {
    width: 2px;
    flex: 1;
    background: var(--livellm-border, #e0e0e0);
    margin-top: 4px;
  }
  .timeline-content { flex: 1; padding-top: 0; }
  .timeline-date {
    font-size: 12px;
    color: var(--livellm-primary, #6c5ce7);
    font-weight: 600;
    margin-bottom: 2px;
  }
  .timeline-event-title {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 4px;
  }
  .timeline-description {
    font-size: 13px;
    color: var(--livellm-text-secondary, #6c757d);
    line-height: var(--livellm-line-height, 1.6);
  }
`;

interface TimelineEvent {
  date: string;
  title: string;
  description?: string;
  color?: string;
}

export class LiveLLMTimeline extends LiveLLMComponent {
  render(): void {
    const title: string = this._props.title || '';
    const rawEvents = this._props.events || this._props.items || this._props.entries || [];
    const events: TimelineEvent[] = Array.isArray(rawEvents)
      ? rawEvents.map((e: any) => this.normalizeEvent(e))
      : [];

    this.setStyles(TIMELINE_STYLES);

    const eventsHtml = events.map((event, i) => {
      const showLine = i < events.length - 1;
      const dotStyle = event.color ? `background:${event.color};box-shadow:0 0 0 2px ${event.color};` : '';

      return `
        <div class="timeline-item">
          <div class="timeline-marker-col">
            <div class="timeline-dot" ${dotStyle ? `style="${dotStyle}"` : ''}></div>
            ${showLine ? '<div class="timeline-line"></div>' : ''}
          </div>
          <div class="timeline-content">
            <div class="timeline-date">${this.escapeHtml(event.date)}</div>
            <div class="timeline-event-title">${this.escapeHtml(event.title)}</div>
            ${event.description ? `<div class="timeline-description">${this.escapeHtml(event.description)}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');

    this.setContent(`
      <div class="timeline-container">
        ${title ? `<div class="timeline-title">${this.escapeHtml(title)}</div>` : ''}
        ${eventsHtml}
      </div>
    `);
  }

  private normalizeEvent(event: any): TimelineEvent {
    if (typeof event === 'string') {
      return { date: '', title: event };
    }
    if (!event || typeof event !== 'object') {
      return { date: '', title: String(event ?? '') };
    }
    return {
      date: String(event.date ?? event.time ?? event.when ?? event.timestamp ?? ''),
      title: String(event.title ?? event.label ?? event.name ?? event.event ?? ''),
      description: event.description ?? event.content ?? event.body ?? event.detail ?? undefined,
      color: event.color,
    };
  }

  private escapeHtml(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export const TIMELINE_REGISTRATION: RegisterOptions = {
  schema: {
    title: { type: 'string', default: '' },
    events: { type: 'array' },
    items: { type: 'array' },
    entries: { type: 'array' },
  },
  category: 'block',
  skeleton: {
    html: '<div style="height:200px;border-radius:8px;background:#e0e0e0;"></div>',
    height: '200px',
  },
};
