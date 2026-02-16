import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../src/core/events';
import { Registry } from '../../src/core/registry';
import { Parser } from '../../src/core/parser';
import { Renderer } from '../../src/core/renderer';

class MockAlert extends HTMLElement {}

describe('Renderer', () => {
  let events: EventBus;
  let registry: Registry;
  let parser: Parser;
  let renderer: Renderer;

  beforeEach(() => {
    events = new EventBus();
    registry = new Registry(events);
    parser = new Parser(events, registry);
    renderer = new Renderer(events, registry, parser);

    registry.register('alert', MockAlert, {
      schema: {
        type: { type: 'enum', enum: ['info', 'success', 'warning', 'error'], default: 'info' },
        text: { type: 'string', required: true },
      },
      category: 'inline',
    });
  });

  it('should render markdown into a container element', () => {
    const container = document.createElement('div');
    renderer.render('# Hello\n\nWorld', container);

    expect(container.innerHTML).toContain('Hello');
    expect(container.innerHTML).toContain('World');
  });

  it('should render markdown into a container by selector', () => {
    const container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);

    renderer.render('# Hello', '#test-container');

    expect(container.innerHTML).toContain('Hello');
    document.body.removeChild(container);
  });

  it('should return null for non-existent container selector', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = renderer.render('test', '#nonexistent');
    expect(result).toBeNull();
    errorSpy.mockRestore();
  });

  it('should render livellm components as custom elements', () => {
    const container = document.createElement('div');
    const md = '```livellm:alert\n{"type":"success","text":"Done!"}\n```';
    renderer.render(md, container);

    expect(container.innerHTML).toContain('livellm-alert');
    expect(container.innerHTML).toContain('data-livellm="alert"');
  });

  it('should renderToString return HTML', () => {
    const html = renderer.renderToString('**bold**');
    expect(html).toContain('<strong>bold</strong>');
  });

  it('should emit renderer events', () => {
    const onStart = vi.fn();
    const onComplete = vi.fn();

    events.on('renderer:start', onStart);
    events.on('renderer:complete', onComplete);

    const container = document.createElement('div');
    renderer.render('Hello', container);

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('should clear container content', () => {
    const container = document.createElement('div');
    container.innerHTML = '<p>old content</p>';

    renderer.clear(container);
    expect(container.innerHTML).toBe('');
  });

  it('should bind action listeners on render', () => {
    const onAction = vi.fn();
    events.on('action:triggered', onAction);

    const container = document.createElement('div');
    renderer.render('Hello', container);

    // Simulate a livellm:action event
    const event = new CustomEvent('livellm:action', {
      bubbles: true,
      composed: true,
      detail: {
        component: 'alert',
        action: 'click',
        data: { value: 'test' },
        timestamp: Date.now(),
        componentId: 'test-id',
      },
    });
    container.dispatchEvent(event);

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({
      type: 'livellm:action',
      component: 'alert',
      action: 'click',
    }));
  });
});
