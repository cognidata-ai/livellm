import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../src/core/events';
import { Registry } from '../../src/core/registry';
import { Parser } from '../../src/core/parser';
import { Renderer } from '../../src/core/renderer';
import { StreamRenderer } from '../../src/core/stream-renderer';

class MockAlert extends HTMLElement {
  connectedCallback() {
    const props = JSON.parse(this.getAttribute('data-props') || '{}');
    this.innerHTML = `<div class="alert">${props.text || ''}</div>`;
  }
}

class MockTabs extends HTMLElement {
  connectedCallback() {
    this.innerHTML = '<div class="tabs">tabs</div>';
  }
}

describe('Streaming Pipeline', () => {
  let events: EventBus;
  let registry: Registry;
  let parser: Parser;
  let renderer: Renderer;
  let container: HTMLElement;

  beforeEach(() => {
    events = new EventBus();
    registry = new Registry(events);
    parser = new Parser(events, registry);
    renderer = new Renderer(events, registry, parser);
    container = document.createElement('div');

    registry.register('alert', MockAlert, {
      schema: {
        type: { type: 'enum', enum: ['info', 'success', 'warning', 'error'], default: 'info' },
        text: { type: 'string', required: true },
      },
      category: 'inline',
    });
    registry.register('tabs', MockTabs, {
      schema: {
        tabs: { type: 'array', required: true },
        defaultTab: { type: 'number', default: 0 },
      },
      category: 'block',
    });
  });

  it('should stream text token-by-token and render', () => {
    const sr = new StreamRenderer(events, registry, parser, renderer, container, {
      showCursor: false,
    });

    const tokens = ['# He', 'llo ', 'World\n', '\nSome ', 'text.'];
    tokens.forEach((t) => sr.push(t));
    sr.end();

    expect(container.textContent).toContain('Hello World');
    expect(container.textContent).toContain('Some text');
  });

  it('should detect livellm component during streaming and show skeleton', () => {
    const onComponentStart = vi.fn();
    const onComponentComplete = vi.fn();

    events.on('stream:component:start', onComponentStart);
    events.on('stream:component:complete', onComponentComplete);

    const sr = new StreamRenderer(events, registry, parser, renderer, container, {
      showCursor: false,
    });

    // Stream text before component
    sr.push('Hello\n\n');

    // Stream a livellm block character by character
    sr.push('`');
    sr.push('`');
    sr.push('`');
    sr.push('livellm:alert\n');

    // At this point, a skeleton should appear
    expect(onComponentStart).toHaveBeenCalledWith('alert');
    expect(container.querySelector('.livellm-skeleton-wrapper')).toBeTruthy();

    // Stream the JSON body
    sr.push('{"type": "success", ');
    sr.push('"text": "Done!"}');
    sr.push('\n```');

    // Component should be finalized
    expect(onComponentComplete).toHaveBeenCalledWith('alert', expect.any(Object));

    sr.end();

    // The skeleton should have been replaced with the real component
    expect(container.querySelector('.livellm-skeleton-wrapper')).toBeNull();
    expect(container.querySelector('livellm-alert')).toBeTruthy();
  });

  it('should handle multiple components in a stream', () => {
    const sr = new StreamRenderer(events, registry, parser, renderer, container, {
      showCursor: false,
    });

    sr.push('# Title\n\n');
    sr.push('```livellm:alert\n');
    sr.push('{"type":"info","text":"First"}\n```');
    sr.push('\n\nMiddle text\n\n');
    sr.push('```livellm:alert\n');
    sr.push('{"type":"success","text":"Second"}\n```');
    sr.push('\n\nEnd text.');
    sr.end();

    const alerts = container.querySelectorAll('livellm-alert');
    expect(alerts.length).toBe(2);
    expect(container.textContent).toContain('Title');
    expect(container.textContent).toContain('End text');
  });

  it('should render fallback when component JSON is invalid during streaming', () => {
    const sr = new StreamRenderer(events, registry, parser, renderer, container, {
      showCursor: false,
    });

    sr.push('```livellm:alert\n');
    sr.push('{invalid json}\n```');
    sr.end();

    expect(container.querySelector('livellm-alert')).toBeNull();
    expect(container.querySelector('.livellm-fallback')).toBeTruthy();
  });

  it('should render fallback when stream ends mid-component', () => {
    const sr = new StreamRenderer(events, registry, parser, renderer, container, {
      showCursor: false,
    });

    sr.push('```livellm:alert\n');
    sr.push('{"type":"info","text":"incomplete');
    // End without closing the fence
    sr.end();

    // Should render as fallback, not crash
    expect(container.querySelector('.livellm-fallback')).toBeTruthy();
  });

  it('should handle regular code fences without treating them as livellm components', () => {
    const sr = new StreamRenderer(events, registry, parser, renderer, container, {
      showCursor: false,
    });

    sr.push('```javascript\nconsole.log("hi");\n```');
    sr.end();

    expect(container.textContent).toContain('console.log');
    expect(container.querySelector('livellm-alert')).toBeNull();
    expect(container.querySelector('.livellm-skeleton-wrapper')).toBeNull();
  });

  it('should report state transitions', () => {
    const sr = new StreamRenderer(events, registry, parser, renderer, container, {
      showCursor: false,
    });

    expect(sr.getState()).toBe('IDLE');

    sr.push('Hello');
    expect(sr.getState()).toBe('RENDERING');

    sr.push('\n\n```livellm:alert\n');
    expect(sr.getState()).toBe('BUFFERING');

    sr.push('{"type":"info","text":"test"}\n```');
    expect(sr.getState()).toBe('RENDERING');

    sr.end();
    expect(sr.getState()).toBe('INTERACTIVE');
  });

  it('should accumulate full text in getFullText()', () => {
    const sr = new StreamRenderer(events, registry, parser, renderer, container, {
      showCursor: false,
    });

    sr.push('Hello ');
    sr.push('World');
    sr.end();

    expect(sr.getFullText()).toBe('Hello World');
  });

  it('should simulate delayed token streaming', async () => {
    const sr = new StreamRenderer(events, registry, parser, renderer, container, {
      showCursor: false,
    });

    const tokens = [
      'Here is ',
      'a response ',
      'with a component:\n\n',
      '```livellm:alert\n',
      '{"type":"success",',
      '"text":"Streaming works!"}\n',
      '```\n\n',
      'After the component.',
    ];

    // Simulate delayed token delivery
    for (const token of tokens) {
      sr.push(token);
      await new Promise((r) => setTimeout(r, 5));
    }

    sr.end();

    expect(container.querySelector('livellm-alert')).toBeTruthy();
    expect(container.textContent).toContain('After the component');
  });

  it('should handle inline backticks without false positive fence detection', () => {
    const sr = new StreamRenderer(events, registry, parser, renderer, container, {
      showCursor: false,
    });

    sr.push('Use `code` inline and ``double`` inline.');
    sr.end();

    expect(container.textContent).toContain('code');
    expect(container.querySelector('.livellm-skeleton-wrapper')).toBeNull();
  });

  // ═══ Inline component streaming tests ════════════════════

  it('should render inline livellm components during streaming', () => {
    const sr = new StreamRenderer(events, registry, parser, renderer, container, {
      showCursor: false,
    });

    sr.push('Status: `livellm:alert{"type":"info","text":"Hello"}`');
    sr.end();

    expect(container.querySelector('livellm-alert')).toBeTruthy();
    expect(container.innerHTML).toContain('data-livellm="alert"');
  });

  it('should render inline livellm component when streamed char-by-char', () => {
    const sr = new StreamRenderer(events, registry, parser, renderer, container, {
      showCursor: false,
    });

    const text = 'Info: `livellm:alert{"type":"info","text":"Test"}`';
    for (const ch of text) {
      sr.push(ch);
    }
    sr.end();

    expect(container.querySelector('livellm-alert')).toBeTruthy();
  });

  it('should render inline component with text before and after', () => {
    const sr = new StreamRenderer(events, registry, parser, renderer, container, {
      showCursor: false,
    });

    sr.push('Before `livellm:alert{"type":"success","text":"Yes!"}` after.');
    sr.end();

    expect(container.querySelector('livellm-alert')).toBeTruthy();
    expect(container.textContent).toContain('Before');
    expect(container.textContent).toContain('after.');
  });

  it('should flush residual single backtick in fenceAccum on end()', () => {
    const sr = new StreamRenderer(events, registry, parser, renderer, container, {
      showCursor: false,
    });

    sr.push('Hello `');
    sr.end();

    // The trailing backtick should be flushed to text, not lost
    expect(container.textContent).toContain('Hello');
  });

  it('should flush residual double backticks in fenceAccum on end()', () => {
    const sr = new StreamRenderer(events, registry, parser, renderer, container, {
      showCursor: false,
    });

    sr.push('Code: ``');
    sr.end();

    expect(container.textContent).toContain('Code:');
  });

  it('should handle both block and inline components in one stream', () => {
    const sr = new StreamRenderer(events, registry, parser, renderer, container, {
      showCursor: false,
    });

    sr.push('# Title\n\n');
    sr.push('Status: `livellm:alert{"type":"info","text":"Inline"}` ok\n\n');
    sr.push('```livellm:alert\n');
    sr.push('{"type":"success","text":"Block"}\n```');
    sr.push('\n\nDone.');
    sr.end();

    const alerts = container.querySelectorAll('livellm-alert');
    expect(alerts.length).toBe(2);
    expect(container.textContent).toContain('Title');
    expect(container.textContent).toContain('Done.');
  });

  it('should bind actions after stream ends', () => {
    const onAction = vi.fn();
    events.on('action:triggered', onAction);

    const sr = new StreamRenderer(events, registry, parser, renderer, container, {
      showCursor: false,
    });

    sr.push('```livellm:alert\n{"type":"info","text":"test"}\n```');
    sr.end();

    // Simulate an action from the component
    const actionEvent = new CustomEvent('livellm:action', {
      bubbles: true,
      composed: true,
      detail: { component: 'alert', action: 'click', data: {}, timestamp: Date.now() },
    });
    container.dispatchEvent(actionEvent);

    expect(onAction).toHaveBeenCalled();
  });
});
