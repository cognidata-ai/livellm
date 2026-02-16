import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../src/core/events';

describe('EventBus', () => {
  it('should register and emit events', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('test', handler);
    bus.emit('test', 'arg1', 'arg2');

    expect(handler).toHaveBeenCalledWith('arg1', 'arg2');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should support multiple handlers for the same event', () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();

    bus.on('test', h1);
    bus.on('test', h2);
    bus.emit('test', 'data');

    expect(h1).toHaveBeenCalledWith('data');
    expect(h2).toHaveBeenCalledWith('data');
  });

  it('should remove a specific handler with off()', () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();

    bus.on('test', h1);
    bus.on('test', h2);
    bus.off('test', h1);
    bus.emit('test');

    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it('should support once() — fire handler only once', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.once('test', handler);
    bus.emit('test');
    bus.emit('test');

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should not throw when emitting event with no handlers', () => {
    const bus = new EventBus();
    expect(() => bus.emit('nonexistent')).not.toThrow();
  });

  it('should removeAll handlers for a specific event', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('test', handler);
    bus.removeAll('test');
    bus.emit('test');

    expect(handler).not.toHaveBeenCalled();
  });

  it('should removeAll handlers when no event specified', () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();

    bus.on('event1', h1);
    bus.on('event2', h2);
    bus.removeAll();
    bus.emit('event1');
    bus.emit('event2');

    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  it('should return correct listenerCount', () => {
    const bus = new EventBus();

    expect(bus.listenerCount('test')).toBe(0);

    bus.on('test', () => {});
    bus.on('test', () => {});
    expect(bus.listenerCount('test')).toBe(2);
  });

  it('should catch errors in handlers without stopping other handlers', () => {
    const bus = new EventBus();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const h1 = vi.fn(() => { throw new Error('handler error'); });
    const h2 = vi.fn();

    bus.on('test', h1);
    bus.on('test', h2);
    bus.emit('test');

    expect(h2).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('should log events in debug mode', () => {
    const bus = new EventBus();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    bus.setDebug(true);
    bus.emit('test:event', 'payload');

    expect(logSpy).toHaveBeenCalledWith('[LiveLLM Event] test:event', 'payload');
    logSpy.mockRestore();
  });
});
