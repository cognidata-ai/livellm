import { describe, it, expect, beforeEach } from 'vitest';
import { LiveLLMTimeline, TIMELINE_REGISTRATION } from '../../src/components/block/timeline';

const tagName = 'livellm-test-timeline';
try { customElements.define(tagName, LiveLLMTimeline); } catch {}

function createTimeline(props: Record<string, any>): LiveLLMTimeline {
  const el = document.createElement(tagName) as LiveLLMTimeline;
  el.setAttribute('data-livellm', 'timeline');
  el.setAttribute('data-props', JSON.stringify(props));
  document.body.appendChild(el);
  return el;
}

describe('Timeline Component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should export registration with correct schema', () => {
    expect(TIMELINE_REGISTRATION.schema.events).toBeDefined();
    expect(TIMELINE_REGISTRATION.schema.events.type).toBe('array');
    expect(TIMELINE_REGISTRATION.category).toBe('block');
  });

  it('should render timeline events', () => {
    const el = createTimeline({
      events: [
        { date: '2024-01', title: 'Project Start', description: 'Kicked off the project' },
        { date: '2024-03', title: 'Beta Release' },
        { date: '2024-06', title: 'v1.0 Launch' },
      ],
    });
    const shadow = el.shadowRoot!;
    const items = shadow.querySelectorAll('.timeline-item');
    expect(items.length).toBe(3);
    const dates = shadow.querySelectorAll('.timeline-date');
    expect(dates[0].textContent).toContain('2024-01');
    const titles = shadow.querySelectorAll('.timeline-event-title');
    expect(titles[0].textContent).toContain('Project Start');
  });

  it('should render title', () => {
    const el = createTimeline({
      title: 'Project History',
      events: [{ date: '2024', title: 'Start' }],
    });
    const shadow = el.shadowRoot!;
    expect(shadow.querySelector('.timeline-title')?.textContent).toContain('Project History');
  });

  it('should show connecting lines between events', () => {
    const el = createTimeline({
      events: [
        { date: '2024-01', title: 'First' },
        { date: '2024-02', title: 'Second' },
      ],
    });
    const shadow = el.shadowRoot!;
    const lines = shadow.querySelectorAll('.timeline-line');
    // Last item should not have a line
    expect(lines.length).toBe(1);
  });

  it('should support custom dot colors', () => {
    const el = createTimeline({
      events: [{ date: '2024', title: 'Custom', color: '#ff0000' }],
    });
    const shadow = el.shadowRoot!;
    const dot = shadow.querySelector('.timeline-dot') as HTMLElement;
    expect(dot.getAttribute('style')).toContain('#ff0000');
  });

  it('should render descriptions when provided', () => {
    const el = createTimeline({
      events: [{ date: '2024', title: 'Event', description: 'Details here' }],
    });
    const shadow = el.shadowRoot!;
    const desc = shadow.querySelector('.timeline-description');
    expect(desc?.textContent).toContain('Details here');
  });
});
