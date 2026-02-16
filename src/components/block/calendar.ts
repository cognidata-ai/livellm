import { LiveLLMComponent } from '../base';
import type { RegisterOptions } from '../../core/registry';

const CALENDAR_STYLES = `
  :host {
    display: block;
    margin: 12px 0;
  }
  .livellm-component {
    font-family: var(--livellm-font, system-ui, -apple-system, sans-serif);
    font-size: var(--livellm-font-size, 14px);
    color: var(--livellm-text, #1a1a1a);
  }
  .cal-container {
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: var(--livellm-border-radius, 8px);
    background: var(--livellm-bg-component, #ffffff);
    box-shadow: var(--livellm-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
    overflow: hidden;
  }
  .cal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--livellm-bg-secondary, #f8f9fa);
    border-bottom: 1px solid var(--livellm-border, #e0e0e0);
  }
  .cal-title { font-weight: 700; font-size: 15px; }
  .cal-nav-btn {
    padding: 4px 10px;
    border: 1px solid var(--livellm-border, #e0e0e0);
    border-radius: 4px;
    background: var(--livellm-bg-component, #ffffff);
    cursor: pointer;
    font-size: 14px;
  }
  .cal-nav-btn:hover { background: var(--livellm-bg-secondary, #f8f9fa); }
  .cal-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;
    background: var(--livellm-border, #e0e0e0);
  }
  .cal-day-header {
    text-align: center;
    padding: 8px 4px;
    font-size: 11px;
    font-weight: 600;
    color: var(--livellm-text-secondary, #6c757d);
    background: var(--livellm-bg-secondary, #f8f9fa);
    text-transform: uppercase;
  }
  .cal-cell {
    background: var(--livellm-bg-component, #ffffff);
    min-height: 40px;
    padding: 4px 6px;
    font-size: 13px;
    position: relative;
  }
  .cal-cell.other-month { color: var(--livellm-border, #e0e0e0); }
  .cal-cell.today {
    font-weight: 700;
    color: var(--livellm-primary, #6c5ce7);
  }
  .cal-cell.has-event::after {
    content: '';
    position: absolute;
    bottom: 3px;
    left: 50%;
    transform: translateX(-50%);
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--livellm-primary, #6c5ce7);
  }
  .cal-events {
    padding: 12px 16px;
    border-top: 1px solid var(--livellm-border, #e0e0e0);
  }
  .cal-event {
    display: flex;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid var(--livellm-border, #e0e0e0);
  }
  .cal-event:last-child { border-bottom: none; }
  .cal-event-time {
    font-size: 12px;
    font-weight: 600;
    color: var(--livellm-primary, #6c5ce7);
    min-width: 50px;
  }
  .cal-event-title { font-size: 13px; }
`;

interface CalendarEvent {
  date: string;
  title: string;
  time?: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export class LiveLLMCalendar extends LiveLLMComponent {
  private viewYear: number = 0;
  private viewMonth: number = 0;

  render(): void {
    const events: CalendarEvent[] = this._props.events || [];
    const initialDate = this._props.date ? new Date(this._props.date) : new Date();

    if (this.viewYear === 0) {
      this.viewYear = initialDate.getFullYear();
      this.viewMonth = initialDate.getMonth();
    }

    this.setStyles(CALENDAR_STYLES);

    const today = new Date();
    const firstDay = new Date(this.viewYear, this.viewMonth, 1);
    const lastDay = new Date(this.viewYear, this.viewMonth + 1, 0);
    const startOffset = firstDay.getDay();

    const eventDates = new Set(events.map(e => {
      const d = new Date(e.date);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }));

    // Day headers
    const dayHeaders = DAYS.map(d => `<div class="cal-day-header">${d}</div>`).join('');

    // Calendar cells
    const cells: string[] = [];
    // Previous month days
    const prevMonth = new Date(this.viewYear, this.viewMonth, 0);
    for (let i = startOffset - 1; i >= 0; i--) {
      cells.push(`<div class="cal-cell other-month">${prevMonth.getDate() - i}</div>`);
    }
    // Current month days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const key = `${this.viewYear}-${this.viewMonth}-${d}`;
      const isToday = today.getFullYear() === this.viewYear && today.getMonth() === this.viewMonth && today.getDate() === d;
      const hasEvent = eventDates.has(key);
      const classes = ['cal-cell'];
      if (isToday) classes.push('today');
      if (hasEvent) classes.push('has-event');
      cells.push(`<div class="${classes.join(' ')}">${d}</div>`);
    }
    // Next month days
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      cells.push(`<div class="cal-cell other-month">${d}</div>`);
    }

    // Events list for this month
    const monthEvents = events.filter(e => {
      const d = new Date(e.date);
      return d.getFullYear() === this.viewYear && d.getMonth() === this.viewMonth;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const eventsListHtml = monthEvents.length > 0 ? `
      <div class="cal-events">
        ${monthEvents.map(e => `
          <div class="cal-event">
            <span class="cal-event-time">${e.time || new Date(e.date).getDate() + ''}</span>
            <span class="cal-event-title">${this.escapeHtml(e.title)}</span>
          </div>
        `).join('')}
      </div>
    ` : '';

    this.setContent(`
      <div class="cal-container">
        <div class="cal-header">
          <button class="cal-nav-btn" data-dir="prev">\u2190</button>
          <span class="cal-title">${MONTHS[this.viewMonth]} ${this.viewYear}</span>
          <button class="cal-nav-btn" data-dir="next">\u2192</button>
        </div>
        <div class="cal-grid">
          ${dayHeaders}
          ${cells.join('')}
        </div>
        ${eventsListHtml}
      </div>
    `);

    this.shadowRoot?.querySelector('[data-dir="prev"]')?.addEventListener('click', () => {
      this.viewMonth--;
      if (this.viewMonth < 0) { this.viewMonth = 11; this.viewYear--; }
      this.render();
    });
    this.shadowRoot?.querySelector('[data-dir="next"]')?.addEventListener('click', () => {
      this.viewMonth++;
      if (this.viewMonth > 11) { this.viewMonth = 0; this.viewYear++; }
      this.render();
    });
  }

  private escapeHtml(str: string): string {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

export const CALENDAR_REGISTRATION: RegisterOptions = {
  schema: {
    date: { type: 'string', default: '' },
    events: { type: 'array', default: [] },
  },
  category: 'block',
  skeleton: {
    html: '<div style="height:320px;border-radius:8px;background:#e0e0e0;"></div>',
    height: '320px',
  },
};
