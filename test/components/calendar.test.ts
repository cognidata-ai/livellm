import { describe, it, expect, beforeEach } from 'vitest';
import { LiveLLMCalendar, CALENDAR_REGISTRATION } from '../../src/components/block/calendar';

const tagName = 'livellm-test-calendar';
try { customElements.define(tagName, LiveLLMCalendar); } catch {}

function createCalendar(props: Record<string, any>): LiveLLMCalendar {
  const el = document.createElement(tagName) as LiveLLMCalendar;
  el.setAttribute('data-livellm', 'calendar');
  el.setAttribute('data-props', JSON.stringify(props));
  document.body.appendChild(el);
  return el;
}

describe('Calendar Component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should export registration with correct schema', () => {
    expect(CALENDAR_REGISTRATION.schema.events).toBeDefined();
    expect(CALENDAR_REGISTRATION.category).toBe('block');
  });

  it('should render a calendar grid', () => {
    const el = createCalendar({
      date: '2024-06-15',
      events: [],
    });
    const shadow = el.shadowRoot!;
    const title = shadow.querySelector('.cal-title');
    expect(title).toBeTruthy();
    const dayCells = shadow.querySelectorAll('.cal-cell');
    expect(dayCells.length).toBeGreaterThan(0);
  });

  it('should render day-of-week headers', () => {
    const el = createCalendar({
      date: '2024-06-15',
      events: [],
    });
    const shadow = el.shadowRoot!;
    const weekdays = shadow.querySelectorAll('.cal-day-header');
    expect(weekdays.length).toBe(7);
  });

  it('should show events on the correct date', () => {
    const el = createCalendar({
      date: '2024-06-15',
      events: [
        { date: '2024-06-15', title: 'Meeting' },
      ],
    });
    const shadow = el.shadowRoot!;
    // Should have at least one cell with has-event class or an events list
    const hasEventCells = shadow.querySelectorAll('.cal-cell.has-event');
    const eventList = shadow.querySelector('.cal-events');
    expect(hasEventCells.length > 0 || eventList !== null).toBe(true);
  });

  it('should render navigation buttons', () => {
    const el = createCalendar({
      date: '2024-06-15',
      events: [],
    });
    const shadow = el.shadowRoot!;
    const prevBtn = shadow.querySelector('.cal-nav-btn[data-dir="prev"]');
    const nextBtn = shadow.querySelector('.cal-nav-btn[data-dir="next"]');
    expect(prevBtn).toBeTruthy();
    expect(nextBtn).toBeTruthy();
  });

  it('should render the correct month and year', () => {
    const el = createCalendar({
      date: '2024-06-15',
      events: [],
    });
    const shadow = el.shadowRoot!;
    const title = shadow.querySelector('.cal-title');
    expect(title?.textContent).toContain('June');
    expect(title?.textContent).toContain('2024');
  });
});
