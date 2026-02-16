import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../src/core/events';
import { Transformer } from '../../src/core/transformer';

describe('Transformer', () => {
  let events: EventBus;
  let transformer: Transformer;

  beforeEach(() => {
    events = new EventBus();
    transformer = new Transformer(events);
  });

  it('should return markdown unchanged when mode is off', () => {
    const t = new Transformer(events, { mode: 'off' });
    const md = '# Hello\n\nSome text.';
    expect(t.transform(md)).toBe(md);
  });

  it('should register and use a custom detector', () => {
    transformer.register('greeting-detector', {
      detect: (markdown) => {
        const match = markdown.match(/Hello, (.*?)!/);
        if (match) {
          return [{
            start: match.index!,
            end: match.index! + match[0].length,
            data: { name: match[1] },
            confidence: 0.95,
            apply: () => {},
          }];
        }
        return [];
      },
      transform: (match) => {
        return `\`\`\`livellm:badge\n{"text":"Hello ${match.data.name}!","color":"green"}\n\`\`\``;
      },
    });

    const result = transformer.transform('Hello, World!');
    expect(result).toContain('livellm:badge');
    expect(result).toContain('Hello World!');
  });

  it('should not transform when confidence is below threshold', () => {
    transformer.register('low-confidence', {
      detect: (markdown) => [{
        start: 0,
        end: markdown.length,
        data: {},
        confidence: 0.3,
        apply: () => {},
      }],
      transform: () => '```livellm:test\n{}\n```',
    });

    const md = 'Some text';
    const result = transformer.transform(md);
    expect(result).toBe(md); // Not transformed due to low confidence
  });

  it('should emit events in passive mode without transforming', () => {
    const passiveTransformer = new Transformer(events, { mode: 'passive' });
    const onDetected = vi.fn();
    events.on('transformer:detected', onDetected);

    passiveTransformer.register('test-detector', {
      detect: () => [{
        start: 0, end: 5, data: {}, confidence: 0.9, apply: () => {},
      }],
      transform: () => 'transformed',
    });

    const md = 'Hello';
    const result = passiveTransformer.transform(md);

    expect(result).toBe(md); // Not transformed
    expect(onDetected).toHaveBeenCalled();
  });

  it('should disable and enable detectors', () => {
    transformer.register('my-detector', {
      detect: () => [{
        start: 0, end: 5, data: {}, confidence: 0.95, apply: () => {},
      }],
      transform: () => 'TRANSFORMED',
    });

    expect(transformer.listDetectors()).toContain('my-detector');

    transformer.disable('my-detector');
    expect(transformer.listDetectors()).not.toContain('my-detector');

    const result = transformer.transform('Hello');
    expect(result).toBe('Hello');

    transformer.enable('my-detector');
    expect(transformer.listDetectors()).toContain('my-detector');
  });

  it('should list active detectors', () => {
    transformer.register('a', { detect: () => [], transform: () => '' });
    transformer.register('b', { detect: () => [], transform: () => '' });
    transformer.register('c', { detect: () => [], transform: () => '' });

    expect(transformer.listDetectors()).toEqual(['a', 'b', 'c']);

    transformer.disable('b');
    expect(transformer.listDetectors()).toEqual(['a', 'c']);
  });

  it('should emit transformer events', () => {
    const onStart = vi.fn();
    const onEnriched = vi.fn();

    events.on('transformer:start', onStart);
    events.on('transformer:enriched', onEnriched);

    transformer.transform('Hello world');

    expect(onStart).toHaveBeenCalledWith('Hello world');
    expect(onEnriched).toHaveBeenCalled();
  });

  it('should handle detector errors gracefully', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    transformer.register('broken', {
      detect: () => { throw new Error('detector broke'); },
      transform: () => '',
    });

    expect(() => transformer.transform('test')).not.toThrow();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
