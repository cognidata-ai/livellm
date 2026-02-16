import { describe, it, expect, vi } from 'vitest';
import {
  parseSSEData,
  parseSSELine,
  connectLiveLLMStream,
} from '../../src/protocol/client';
import type { StreamRendererLike } from '../../src/protocol/client';
import type { StreamEvent } from '../../src/protocol/types';

// ─── parseSSEData ───────────────────────────────────────────

describe('parseSSEData', () => {
  it('should parse a token event', () => {
    const result = parseSSEData('{"type":"token","token":"Hello"}');
    expect(result).toEqual({ type: 'token', token: 'Hello' });
  });

  it('should parse an error event', () => {
    const result = parseSSEData(
      '{"type":"error","code":"rate_limit","message":"Too many requests","recoverable":true}'
    );
    expect(result).toEqual({
      type: 'error',
      code: 'rate_limit',
      message: 'Too many requests',
      recoverable: true,
    });
  });

  it('should parse a metadata event', () => {
    const result = parseSSEData(
      '{"type":"metadata","model":"llama-3.3-70b","provider":"groq"}'
    );
    expect(result).toEqual({
      type: 'metadata',
      model: 'llama-3.3-70b',
      provider: 'groq',
    });
  });

  it('should parse a metadata event with usage', () => {
    const result = parseSSEData(
      '{"type":"metadata","usage":{"prompt_tokens":50,"completion_tokens":100,"total_tokens":150}}'
    );
    expect(result).toEqual({
      type: 'metadata',
      usage: { prompt_tokens: 50, completion_tokens: 100, total_tokens: 150 },
    });
  });

  it('should parse a done event', () => {
    const result = parseSSEData('{"type":"done"}');
    expect(result).toEqual({ type: 'done' });
  });

  it('should parse a done event with fullText', () => {
    const result = parseSSEData('{"type":"done","fullText":"Hello world"}');
    expect(result).toEqual({ type: 'done', fullText: 'Hello world' });
  });

  it('should handle backwards-compatible bare token format', () => {
    const result = parseSSEData('{"token":"Hello"}');
    expect(result).toEqual({ type: 'token', token: 'Hello' });
  });

  it('should return null for empty string', () => {
    expect(parseSSEData('')).toBeNull();
  });

  it('should return null for whitespace-only string', () => {
    expect(parseSSEData('   ')).toBeNull();
  });

  it('should return null for invalid JSON', () => {
    expect(parseSSEData('not json')).toBeNull();
  });

  it('should return null for unknown event type', () => {
    expect(parseSSEData('{"type":"unknown","data":123}')).toBeNull();
  });

  it('should return null for objects without type', () => {
    expect(parseSSEData('{"foo":"bar"}')).toBeNull();
  });

  it('should return null for arrays', () => {
    expect(parseSSEData('[1,2,3]')).toBeNull();
  });

  it('should return null for primitives', () => {
    expect(parseSSEData('"hello"')).toBeNull();
    expect(parseSSEData('42')).toBeNull();
    expect(parseSSEData('true')).toBeNull();
    expect(parseSSEData('null')).toBeNull();
  });
});

// ─── parseSSELine ───────────────────────────────────────────

describe('parseSSELine', () => {
  it('should parse a valid SSE data line', () => {
    const result = parseSSELine('data: {"type":"token","token":"Hi"}');
    expect(result).toEqual({ type: 'token', token: 'Hi' });
  });

  it('should handle extra whitespace after data:', () => {
    const result = parseSSELine('data:   {"type":"done"}  ');
    expect(result).toEqual({ type: 'done' });
  });

  it('should return null for non-data lines', () => {
    expect(parseSSELine('event: message')).toBeNull();
    expect(parseSSELine('id: 123')).toBeNull();
    expect(parseSSELine(': comment')).toBeNull();
    expect(parseSSELine('')).toBeNull();
  });

  it('should return null for lines with only data: prefix', () => {
    expect(parseSSELine('data: ')).toBeNull();
  });
});

// ─── connectLiveLLMStream ───────────────────────────────────

describe('connectLiveLLMStream', () => {
  function createMockStreamRenderer(): StreamRendererLike & {
    tokens: string[];
    ended: boolean;
    aborted: boolean;
  } {
    return {
      tokens: [],
      ended: false,
      aborted: false,
      push(token: string) {
        this.tokens.push(token);
      },
      end() {
        this.ended = true;
      },
      abort() {
        this.aborted = true;
      },
    };
  }

  function createSSEResponse(lines: string[]): Response {
    const text = lines.join('\n') + '\n';
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(text));
        controller.close();
      },
    });
    return new Response(stream);
  }

  it('should push token events to stream renderer', async () => {
    const sr = createMockStreamRenderer();
    const response = createSSEResponse([
      'data: {"type":"token","token":"Hello"}',
      'data: {"type":"token","token":" world"}',
      'data: {"type":"done"}',
    ]);

    await connectLiveLLMStream(response, sr);

    expect(sr.tokens).toEqual(['Hello', ' world']);
    expect(sr.ended).toBe(true);
  });

  it('should call onMetadata for metadata events', async () => {
    const sr = createMockStreamRenderer();
    const onMetadata = vi.fn();
    const response = createSSEResponse([
      'data: {"type":"metadata","model":"llama-70b","provider":"groq"}',
      'data: {"type":"token","token":"Hi"}',
      'data: {"type":"done"}',
    ]);

    await connectLiveLLMStream(response, sr, { onMetadata });

    expect(onMetadata).toHaveBeenCalledWith({
      type: 'metadata',
      model: 'llama-70b',
      provider: 'groq',
    });
    expect(sr.tokens).toEqual(['Hi']);
  });

  it('should call onError for error events', async () => {
    const sr = createMockStreamRenderer();
    const onError = vi.fn();
    const response = createSSEResponse([
      'data: {"type":"token","token":"Hi"}',
      'data: {"type":"error","code":"provider_error","message":"Server error","recoverable":false}',
    ]);

    await connectLiveLLMStream(response, sr, { onError });

    expect(onError).toHaveBeenCalledWith({
      type: 'error',
      code: 'provider_error',
      message: 'Server error',
      recoverable: false,
    });
    expect(sr.ended).toBe(true);
  });

  it('should continue on recoverable errors', async () => {
    const sr = createMockStreamRenderer();
    const onError = vi.fn();
    const response = createSSEResponse([
      'data: {"type":"token","token":"Hi"}',
      'data: {"type":"error","code":"rate_limit","message":"Slow down","recoverable":true}',
      'data: {"type":"token","token":" there"}',
      'data: {"type":"done"}',
    ]);

    await connectLiveLLMStream(response, sr, { onError });

    expect(sr.tokens).toEqual(['Hi', ' there']);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(sr.ended).toBe(true);
  });

  it('should call onDone when done event is received', async () => {
    const sr = createMockStreamRenderer();
    const onDone = vi.fn();
    const response = createSSEResponse([
      'data: {"type":"token","token":"Hello"}',
      'data: {"type":"done","fullText":"Hello"}',
    ]);

    await connectLiveLLMStream(response, sr, { onDone });

    expect(onDone).toHaveBeenCalledWith({
      type: 'done',
      fullText: 'Hello',
    });
  });

  it('should handle legacy [DONE] string', async () => {
    const sr = createMockStreamRenderer();
    const onDone = vi.fn();
    const response = createSSEResponse([
      'data: {"type":"token","token":"Hi"}',
      'data: [DONE]',
    ]);

    await connectLiveLLMStream(response, sr, { onDone });

    expect(sr.tokens).toEqual(['Hi']);
    expect(sr.ended).toBe(true);
    expect(onDone).toHaveBeenCalledWith({ type: 'done' });
  });

  it('should handle legacy bare token format', async () => {
    const sr = createMockStreamRenderer();
    const response = createSSEResponse([
      'data: {"token":"Hello"}',
      'data: {"token":" world"}',
      'data: [DONE]',
    ]);

    await connectLiveLLMStream(response, sr);

    expect(sr.tokens).toEqual(['Hello', ' world']);
    expect(sr.ended).toBe(true);
  });

  it('should skip non-data lines and invalid JSON', async () => {
    const sr = createMockStreamRenderer();
    const response = createSSEResponse([
      ': heartbeat',
      'event: ping',
      'data: not-json',
      'data: {"type":"token","token":"OK"}',
      'data: {"type":"done"}',
    ]);

    await connectLiveLLMStream(response, sr);

    expect(sr.tokens).toEqual(['OK']);
    expect(sr.ended).toBe(true);
  });

  it('should end stream renderer when stream closes without done event', async () => {
    const sr = createMockStreamRenderer();
    const response = createSSEResponse([
      'data: {"type":"token","token":"Hi"}',
    ]);

    await connectLiveLLMStream(response, sr);

    expect(sr.tokens).toEqual(['Hi']);
    expect(sr.ended).toBe(true);
  });

  it('should throw if response has no body', async () => {
    const sr = createMockStreamRenderer();
    const response = new Response(null);
    // Override body to be null
    Object.defineProperty(response, 'body', { value: null });

    await expect(connectLiveLLMStream(response, sr)).rejects.toThrow(
      'Response has no body'
    );
  });
});
