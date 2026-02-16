import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Observer } from '../../src/core/observer';
import { EventBus } from '../../src/core/events';
import { Registry } from '../../src/core/registry';
import { Parser } from '../../src/core/parser';
import { Renderer } from '../../src/core/renderer';

describe('Observer', () => {
  let observer: Observer;
  let events: EventBus;
  let registry: Registry;
  let parser: Parser;
  let renderer: Renderer;
  let container: HTMLElement;

  beforeEach(() => {
    events = new EventBus();
    registry = new Registry(events);
    parser = new Parser();
    renderer = new Renderer(registry, events);
    observer = new Observer(events, registry, parser, renderer);
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
  });

  afterEach(() => {
    observer.disconnect();
    container.remove();
  });

  it('should start observing', () => {
    observer.observe({ target: container });
    expect(observer.isObserving).toBe(true);
  });

  it('should disconnect', () => {
    observer.observe({ target: container });
    observer.disconnect();
    expect(observer.isObserving).toBe(false);
  });

  it('should emit observer:started event', () => {
    let emitted = false;
    events.on('observer:started', () => { emitted = true; });
    observer.observe({ target: container });
    expect(emitted).toBe(true);
  });

  it('should emit observer:stopped event', () => {
    observer.observe({ target: container });
    let emitted = false;
    events.on('observer:stopped', () => { emitted = true; });
    observer.disconnect();
    expect(emitted).toBe(true);
  });

  it('should accept string selector as target', () => {
    observer.observe({ target: '#test-container' });
    expect(observer.isObserving).toBe(true);
  });

  it('should handle invalid target gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    observer.observe({ target: '#nonexistent' });
    expect(observer.isObserving).toBe(false);
    consoleSpy.mockRestore();
  });

  it('should disconnect previous observer when re-observing', () => {
    observer.observe({ target: container });
    expect(observer.isObserving).toBe(true);
    // Re-observe should not throw
    observer.observe({ target: container });
    expect(observer.isObserving).toBe(true);
  });

  it('should support custom debounce option', () => {
    observer.observe({ target: container, debounce: 50 });
    expect(observer.isObserving).toBe(true);
  });

  it('should not throw when disconnecting without observing', () => {
    expect(() => observer.disconnect()).not.toThrow();
  });
});
