import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../src/core/events';
import { Registry } from '../../src/core/registry';

// Simple mock component class
class MockComponent extends HTMLElement {
  connectedCallback() {}
}

describe('Registry', () => {
  let events: EventBus;
  let registry: Registry;

  beforeEach(() => {
    events = new EventBus();
    registry = new Registry(events);
  });

  it('should register a component', () => {
    registry.register('test', MockComponent, {
      schema: { text: { type: 'string', required: true } },
      category: 'block',
    });

    expect(registry.has('test')).toBe(true);
    expect(registry.list()).toContain('test');
  });

  it('should get component registration', () => {
    registry.register('test', MockComponent, {
      schema: { text: { type: 'string' } },
      category: 'inline',
    });

    const reg = registry.get('test');
    expect(reg).toBeDefined();
    expect(reg!.name).toBe('test');
    expect(reg!.tagName).toBe('livellm-test');
    expect(reg!.category).toBe('inline');
  });

  it('should return undefined for unregistered component', () => {
    expect(registry.get('nonexistent')).toBeUndefined();
    expect(registry.has('nonexistent')).toBe(false);
  });

  it('should remove a component', () => {
    registry.register('test', MockComponent);
    expect(registry.remove('test')).toBe(true);
    expect(registry.has('test')).toBe(false);
  });

  it('should return false when removing non-existent component', () => {
    expect(registry.remove('nonexistent')).toBe(false);
  });

  it('should validate props against schema', () => {
    registry.register('test', MockComponent, {
      schema: {
        text: { type: 'string', required: true },
        count: { type: 'number', min: 0, max: 100 },
      },
    });

    // Valid props
    const valid = registry.validate('test', { text: 'hello', count: 50 });
    expect(valid.valid).toBe(true);
    expect(valid.errors).toHaveLength(0);

    // Missing required
    const missing = registry.validate('test', { count: 50 });
    expect(missing.valid).toBe(false);
    expect(missing.errors[0].prop).toBe('text');

    // Wrong type
    const wrongType = registry.validate('test', { text: 123 });
    expect(wrongType.valid).toBe(false);
    expect(wrongType.errors[0].prop).toBe('text');

    // Out of range
    const outOfRange = registry.validate('test', { text: 'hi', count: 200 });
    expect(outOfRange.valid).toBe(false);
    expect(outOfRange.errors[0].prop).toBe('count');
  });

  it('should return invalid for unregistered component validation', () => {
    const result = registry.validate('nonexistent', { foo: 'bar' });
    expect(result.valid).toBe(false);
    expect(result.errors[0].prop).toBe('_component');
  });

  it('should apply defaults from schema', () => {
    registry.register('test', MockComponent, {
      schema: {
        text: { type: 'string', required: true },
        color: { type: 'string', default: 'blue' },
        size: { type: 'number', default: 14 },
      },
    });

    const result = registry.applyDefaults('test', { text: 'hello' });
    expect(result.text).toBe('hello');
    expect(result.color).toBe('blue');
    expect(result.size).toBe(14);
  });

  it('should not override provided values with defaults', () => {
    registry.register('test', MockComponent, {
      schema: {
        color: { type: 'string', default: 'blue' },
      },
    });

    const result = registry.applyDefaults('test', { color: 'red' });
    expect(result.color).toBe('red');
  });

  it('should return skeleton config', () => {
    registry.register('test', MockComponent, {
      skeleton: { html: '<div>loading...</div>', height: '200px' },
    });

    const skeleton = registry.getSkeleton('test');
    expect(skeleton.html).toContain('loading...');
    expect(skeleton.height).toBe('200px');
  });

  it('should return default skeleton for unknown component', () => {
    const skeleton = registry.getSkeleton('nonexistent');
    expect(skeleton.html).toContain('livellm-skeleton');
  });

  it('should emit events on register and remove', () => {
    const onRegister = vi.fn();
    const onRemove = vi.fn();

    events.on('registry:registered', onRegister);
    events.on('registry:removed', onRemove);

    registry.register('test', MockComponent);
    expect(onRegister).toHaveBeenCalledWith('test', expect.any(Object));

    registry.remove('test');
    expect(onRemove).toHaveBeenCalledWith('test');
  });

  it('should list all registered components', () => {
    registry.register('a', MockComponent);
    registry.register('b', MockComponent);
    registry.register('c', MockComponent);

    const list = registry.list();
    expect(list).toEqual(['a', 'b', 'c']);
  });

  it('should clear all registrations', () => {
    registry.register('a', MockComponent);
    registry.register('b', MockComponent);
    registry.clear();

    expect(registry.list()).toHaveLength(0);
    expect(registry.has('a')).toBe(false);
  });

  it('should register lazy component with null class', () => {
    registry.register('lazy-comp', null, {
      lazy: true,
      moduleUrl: 'https://cdn.example.com/component.js',
    });

    const reg = registry.get('lazy-comp');
    expect(reg!.lazy).toBe(true);
    expect(reg!.component).toBeNull();
    expect(reg!.moduleUrl).toBe('https://cdn.example.com/component.js');
  });
});
