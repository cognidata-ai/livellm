import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../src/core/events';
import { Registry } from '../../src/core/registry';
import { Parser } from '../../src/core/parser';

// Mock component
class MockAlert extends HTMLElement {}
class MockBadge extends HTMLElement {}
class MockTabs extends HTMLElement {}

describe('Parser', () => {
  let events: EventBus;
  let registry: Registry;
  let parser: Parser;

  beforeEach(() => {
    events = new EventBus();
    registry = new Registry(events);
    parser = new Parser(events, registry);

    // Register test components
    registry.register('alert', MockAlert, {
      schema: {
        type: { type: 'enum', enum: ['info', 'success', 'warning', 'error'], default: 'info' },
        text: { type: 'string', required: true },
      },
      category: 'inline',
    });
    registry.register('badge', MockBadge, {
      schema: {
        text: { type: 'string', required: true },
        color: { type: 'string', default: 'blue' },
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

  it('should render standard markdown', () => {
    const html = parser.parse('# Hello World\n\nThis is a **test**.');
    expect(html).toContain('<h1>');
    expect(html).toContain('Hello World');
    expect(html).toContain('<strong>test</strong>');
  });

  it('should render standard code blocks normally', () => {
    const md = '```javascript\nconsole.log("hi");\n```';
    const html = parser.parse(md);
    expect(html).toContain('console.log');
    expect(html).not.toContain('livellm-');
  });

  it('should render livellm: block as Web Component tag', () => {
    const md = '```livellm:alert\n{"type": "success", "text": "Done!"}\n```';
    const html = parser.parse(md);

    expect(html).toContain('<livellm-alert');
    expect(html).toContain('data-livellm="alert"');
    expect(html).toContain('data-props=');
  });

  it('should pass props correctly through data-props attribute', () => {
    const md = '```livellm:alert\n{"type": "info", "text": "Hello"}\n```';
    const html = parser.parse(md);

    // Extract data-props value
    const match = html.match(/data-props="([^"]*)"/);
    expect(match).toBeTruthy();

    const propsJson = match![1]
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
    const props = JSON.parse(propsJson);
    expect(props.type).toBe('info');
    expect(props.text).toBe('Hello');
  });

  it('should apply default props from schema', () => {
    const md = '```livellm:badge\n{"text": "Active"}\n```';
    const html = parser.parse(md);

    const match = html.match(/data-props="([^"]*)"/);
    const propsJson = match![1]
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
    const props = JSON.parse(propsJson);
    expect(props.text).toBe('Active');
    expect(props.color).toBe('blue'); // default value
  });

  it('should render fallback for unknown component', () => {
    const md = '```livellm:unknown-component\n{"foo": "bar"}\n```';
    const html = parser.parse(md);

    expect(html).toContain('livellm-fallback');
    expect(html).toContain('&quot;foo&quot;');
    expect(html).not.toContain('<livellm-unknown-component');
  });

  it('should render fallback for invalid JSON', () => {
    const md = '```livellm:alert\n{invalid json}\n```';
    const html = parser.parse(md);

    expect(html).toContain('livellm-fallback');
    expect(html).not.toContain('<livellm-alert');
  });

  it('should render error for invalid props', () => {
    const md = '```livellm:alert\n{"type": "info"}\n```';
    const html = parser.parse(md);

    // text is required but not provided
    expect(html).toContain('livellm-error');
    expect(html).toContain('text is required');
  });

  it('should render inline livellm: components', () => {
    const md = 'Status: `livellm:badge{"text":"Active","color":"green"}`';
    const html = parser.parse(md);

    expect(html).toContain('<livellm-badge');
    expect(html).toContain('data-livellm="badge"');
  });

  it('should render normal inline code normally', () => {
    const md = 'Use `console.log()` for debugging';
    const html = parser.parse(md);

    expect(html).toContain('<code>');
    expect(html).toContain('console.log()');
    expect(html).not.toContain('livellm-');
  });

  it('should handle mixed markdown and components', () => {
    const md = `# Title

Some text with **bold**.

\`\`\`livellm:alert
{"type": "success", "text": "All good!"}
\`\`\`

More text after the component.`;

    const html = parser.parse(md);

    expect(html).toContain('<h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<livellm-alert');
    expect(html).toContain('More text after the component');
  });

  it('should emit parser events', () => {
    const onStart = vi.fn();
    const onComplete = vi.fn();
    const onComponentFound = vi.fn();

    events.on('parser:start', onStart);
    events.on('parser:complete', onComplete);
    events.on('parser:component:found', onComponentFound);

    parser.parse('```livellm:alert\n{"type":"info","text":"Hi"}\n```');

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComponentFound).toHaveBeenCalledWith('alert', expect.any(String));
  });

  it('should emit component:unknown for unregistered components', () => {
    const onUnknown = vi.fn();
    events.on('component:unknown', onUnknown);

    parser.parse('```livellm:mystery\n{"data":"test"}\n```');

    expect(onUnknown).toHaveBeenCalledWith('mystery');
  });

  it('should render tabs block component', () => {
    const md = `\`\`\`livellm:tabs
{
  "tabs": [
    {"label": "Tab 1", "content": "Content 1"},
    {"label": "Tab 2", "content": "Content 2"}
  ]
}
\`\`\``;

    const html = parser.parse(md);
    expect(html).toContain('<livellm-tabs');
    expect(html).toContain('data-livellm="tabs"');
  });
});
