import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../src/core/events';
import { Registry } from '../../src/core/registry';
import { Parser } from '../../src/core/parser';
import { Renderer } from '../../src/core/renderer';
import { StreamRenderer } from '../../src/core/stream-renderer';

class MockAlert extends HTMLElement {}

describe('StreamRenderer', () => {
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
  });

  it('should create a stream renderer', () => {
    const sr = new StreamRenderer(events, registry, parser, renderer, container);
    expect(sr).toBeDefined();
  });

  it('should throw for non-existent container', () => {
    expect(() => {
      new StreamRenderer(events, registry, parser, renderer, '#nonexistent');
    }).toThrow('Container not found');
  });

  it('should push tokens and render text', () => {
    const sr = new StreamRenderer(events, registry, parser, renderer, container, {
      showCursor: false,
    });

    sr.push('Hello ');
    sr.push('World');
    sr.end();

    expect(container.textContent).toContain('Hello');
    expect(container.textContent).toContain('World');
  });

  it('should emit stream events', () => {
    const onToken = vi.fn();
    const onEnd = vi.fn();

    events.on('stream:token', onToken);
    events.on('stream:end', onEnd);

    const sr = new StreamRenderer(events, registry, parser, renderer, container, {
      showCursor: false,
    });

    sr.push('Hello');
    sr.end();

    expect(onToken).toHaveBeenCalledWith('Hello');
    expect(onEnd).toHaveBeenCalled();
  });

  it('should call onStart, onToken, and onEnd callbacks', () => {
    const onStart = vi.fn();
    const onToken = vi.fn();
    const onEnd = vi.fn();

    const sr = new StreamRenderer(events, registry, parser, renderer, container, {
      showCursor: false,
      onStart,
      onToken,
      onEnd,
    });

    sr.push('Hello');
    sr.end();

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onToken).toHaveBeenCalledWith('Hello');
    expect(onEnd).toHaveBeenCalled();
  });

  it('should stop processing after abort', () => {
    const sr = new StreamRenderer(events, registry, parser, renderer, container, {
      showCursor: false,
    });

    sr.push('Hello');
    sr.abort();
    sr.push('World');

    // After abort, further pushes should be ignored
    expect(container.textContent).not.toContain('World');
  });

  it('should show cursor during streaming when enabled', async () => {
    const sr = new StreamRenderer(events, registry, parser, renderer, container, {
      showCursor: true,
      cursorChar: '|',
    });

    sr.push('Hello');

    // The cursor appears after a requestAnimationFrame render cycle.
    // In happy-dom, we trigger the pending RAF by waiting a tick.
    await new Promise((r) => setTimeout(r, 20));

    const cursor = container.querySelector('.livellm-cursor');
    expect(cursor).toBeTruthy();
    expect(cursor?.textContent).toBe('|');

    sr.end();

    // Cursor should be removed after end
    expect(container.querySelector('.livellm-cursor')).toBeNull();
  });
});
