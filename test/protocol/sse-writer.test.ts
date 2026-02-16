import { describe, it, expect, vi } from 'vitest';
import { createSSEWriter, formatActionAsMessage } from '../../src/protocol/server';
import type { SSEWritable } from '../../src/protocol/server';

// ─── createSSEWriter ────────────────────────────────────────

describe('createSSEWriter', () => {
  function createMockResponse(): SSEWritable & { headers: Record<string, string>; output: string[]; ended: boolean } {
    return {
      headers: {},
      output: [],
      ended: false,
      setHeader(name: string, value: string) {
        this.headers[name] = value;
      },
      write(chunk: string) {
        this.output.push(chunk);
        return true;
      },
      end() {
        this.ended = true;
      },
    };
  }

  it('should set SSE headers', () => {
    const res = createMockResponse();
    const sse = createSSEWriter(res);
    sse.writeHeaders();

    expect(res.headers['Content-Type']).toBe('text/event-stream');
    expect(res.headers['Cache-Control']).toBe('no-cache');
    expect(res.headers['Connection']).toBe('keep-alive');
  });

  it('should write token events', () => {
    const res = createMockResponse();
    const sse = createSSEWriter(res);

    sse.token('Hello');
    sse.token(' world');

    expect(res.output).toEqual([
      'data: {"type":"token","token":"Hello"}\n\n',
      'data: {"type":"token","token":" world"}\n\n',
    ]);
  });

  it('should write error events', () => {
    const res = createMockResponse();
    const sse = createSSEWriter(res);

    sse.error('rate_limit', 'Too many requests', true);

    expect(res.output).toEqual([
      'data: {"type":"error","code":"rate_limit","message":"Too many requests","recoverable":true}\n\n',
    ]);
  });

  it('should write error events with default recoverable=false', () => {
    const res = createMockResponse();
    const sse = createSSEWriter(res);

    sse.error('provider_error', 'Server crashed');

    expect(res.output).toEqual([
      'data: {"type":"error","code":"provider_error","message":"Server crashed","recoverable":false}\n\n',
    ]);
  });

  it('should write metadata events', () => {
    const res = createMockResponse();
    const sse = createSSEWriter(res);

    sse.metadata({ model: 'llama-70b', provider: 'groq' });

    expect(res.output).toEqual([
      'data: {"type":"metadata","model":"llama-70b","provider":"groq"}\n\n',
    ]);
  });

  it('should write metadata with usage stats', () => {
    const res = createMockResponse();
    const sse = createSSEWriter(res);

    sse.metadata({
      usage: { prompt_tokens: 50, completion_tokens: 100, total_tokens: 150 },
      latency_ms: 234,
    });

    const parsed = JSON.parse(res.output[0].replace('data: ', '').trim());
    expect(parsed.type).toBe('metadata');
    expect(parsed.usage.total_tokens).toBe(150);
    expect(parsed.latency_ms).toBe(234);
  });

  it('should write done event and end response', () => {
    const res = createMockResponse();
    const sse = createSSEWriter(res);

    sse.done();

    expect(res.output).toEqual([
      'data: {"type":"done"}\n\n',
    ]);
    expect(res.ended).toBe(true);
  });

  it('should write done event with fullText', () => {
    const res = createMockResponse();
    const sse = createSSEWriter(res);

    sse.done('Hello world');

    expect(res.output).toEqual([
      'data: {"type":"done","fullText":"Hello world"}\n\n',
    ]);
    expect(res.ended).toBe(true);
  });

  it('should produce valid JSON in all events', () => {
    const res = createMockResponse();
    const sse = createSSEWriter(res);

    sse.token('test "quotes" and\\backslashes');
    sse.error('unknown', 'Error with "special" chars');
    sse.metadata({ model: 'test' });
    sse.done('full text');

    for (const line of res.output) {
      const jsonStr = line.replace('data: ', '').trim();
      expect(() => JSON.parse(jsonStr)).not.toThrow();
    }
  });

  it('should write a complete stream sequence', () => {
    const res = createMockResponse();
    const sse = createSSEWriter(res);

    sse.writeHeaders();
    sse.metadata({ model: 'llama-70b', provider: 'groq' });
    sse.token('Hello');
    sse.token(' world');
    sse.metadata({ usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 } });
    sse.done('Hello world');

    expect(res.output.length).toBe(5);
    expect(res.ended).toBe(true);

    // Parse all events
    const events = res.output.map((line) => JSON.parse(line.replace('data: ', '').trim()));
    expect(events[0].type).toBe('metadata');
    expect(events[1].type).toBe('token');
    expect(events[2].type).toBe('token');
    expect(events[3].type).toBe('metadata');
    expect(events[4].type).toBe('done');
  });
});

// ─── formatActionAsMessage ──────────────────────────────────

describe('formatActionAsMessage', () => {
  it('should format a select action', () => {
    const result = formatActionAsMessage({
      component: 'choice',
      action: 'select',
      value: 'React',
      label: 'React',
    });
    expect(result).toBe('User selected: React');
  });

  it('should format a select action with context', () => {
    const result = formatActionAsMessage({
      component: 'choice',
      action: 'select',
      value: 'React',
      label: 'React',
      context: 'What framework?',
    });
    expect(result).toBe('[Re: "What framework?"] User selected: React');
  });

  it('should format a confirm action', () => {
    const result = formatActionAsMessage({
      component: 'confirm',
      action: 'confirm',
      value: true,
      label: 'Yes',
    });
    expect(result).toBe('User confirmed');
  });

  it('should format a confirm action with custom label', () => {
    const result = formatActionAsMessage({
      component: 'confirm',
      action: 'confirm',
      value: true,
      label: 'Deploy now',
    });
    expect(result).toBe('User confirmed: Deploy now');
  });

  it('should format a cancel action', () => {
    const result = formatActionAsMessage({
      component: 'confirm',
      action: 'cancel',
      value: false,
      label: 'No',
    });
    expect(result).toBe('User cancelled');
  });

  it('should format a submit action', () => {
    const result = formatActionAsMessage({
      component: 'form',
      action: 'submit',
      value: { name: 'John', email: 'john@test.com' },
      label: 'Contact form',
    });
    expect(result).toContain('User submitted:');
    expect(result).toContain('"name":"John"');
  });

  it('should format a change action', () => {
    const result = formatActionAsMessage({
      component: 'slider',
      action: 'change',
      value: 75,
      label: 'Budget',
    });
    expect(result).toBe('User set Budget to: 75');
  });

  it('should format unknown actions with fallback', () => {
    const result = formatActionAsMessage({
      component: 'custom',
      action: 'custom-action',
      value: { foo: 'bar' },
      label: 'Custom',
    });
    expect(result).toBe('User action (custom-action): Custom');
  });
});
