// ═══════════════════════════════════════════════════════════════
// LiveLLM Response Protocol — Client Helpers
//
// Utilities for parsing SSE events and connecting to StreamRenderer.
// ═══════════════════════════════════════════════════════════════

import type {
  StreamEvent,
  MetadataEvent,
  ErrorEvent,
  DoneEvent,
} from './types';
import { isStreamEvent } from './types';

/**
 * Minimal StreamRenderer interface to avoid circular dependency.
 * Matches the public API of StreamRenderer.
 */
export interface StreamRendererLike {
  push(token: string): void;
  end(): void;
  abort(): void;
}

/**
 * Options for `connectLiveLLMStream`.
 */
export interface ConnectStreamOptions {
  /** Called when a metadata event is received (model info, usage stats). */
  onMetadata?: (event: MetadataEvent) => void;
  /** Called when an error event is received mid-stream. */
  onError?: (event: ErrorEvent) => void;
  /** Called when the done event is received. */
  onDone?: (event: DoneEvent) => void;
}

/**
 * Parse a single SSE data line into a typed StreamEvent.
 *
 * Expects the raw line content (already stripped of the `data: ` prefix).
 * Returns `null` for unparseable or unknown event types.
 *
 * @example
 * ```ts
 * const event = parseSSEData('{"type":"token","token":"Hello"}');
 * // { type: 'token', token: 'Hello' }
 * ```
 */
export function parseSSEData(data: string): StreamEvent | null {
  if (!data || !data.trim()) return null;

  try {
    const parsed = JSON.parse(data);
    if (isStreamEvent(parsed)) {
      return parsed;
    }

    // Backwards compatibility: bare {token: "..."} format (pre-protocol)
    if (typeof parsed === 'object' && parsed !== null && 'token' in parsed && typeof parsed.token === 'string') {
      return { type: 'token', token: parsed.token };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Parse a full SSE line (including `data: ` prefix) into a StreamEvent.
 * Returns `null` if the line is not a valid SSE data line.
 */
export function parseSSELine(line: string): StreamEvent | null {
  if (!line.startsWith('data: ')) return null;
  const data = line.slice(6).trim();
  return parseSSEData(data);
}

/**
 * Connect a fetch Response (SSE stream) to a StreamRenderer
 * using the LiveLLM protocol.
 *
 * Replaces the manual SSE parsing loop typically written in application code.
 * Handles token events, metadata, errors, and the done signal.
 *
 * @example
 * ```ts
 * import LiveLLM from 'livellm';
 * import { connectLiveLLMStream } from 'livellm/protocol';
 *
 * const sr = LiveLLM.createStreamRenderer('#output');
 * const response = await fetch('/api/chat/stream', { method: 'POST', ... });
 *
 * await connectLiveLLMStream(response, sr, {
 *   onMetadata: (meta) => console.log('Model:', meta.model),
 *   onError: (err) => console.error('Stream error:', err.message),
 * });
 * ```
 */
export async function connectLiveLLMStream(
  response: Response,
  streamRenderer: StreamRendererLike,
  options: ConnectStreamOptions = {}
): Promise<void> {
  if (!response.body) {
    throw new Error('[LiveLLM Protocol] Response has no body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();

        // Legacy compatibility: plain [DONE] string
        if (data === '[DONE]') {
          streamRenderer.end();
          options.onDone?.({ type: 'done' });
          return;
        }

        const event = parseSSEData(data);
        if (!event) continue;

        switch (event.type) {
          case 'token':
            streamRenderer.push(event.token);
            break;

          case 'metadata':
            options.onMetadata?.(event);
            break;

          case 'error':
            options.onError?.(event);
            if (!event.recoverable) {
              streamRenderer.end();
              return;
            }
            break;

          case 'done':
            streamRenderer.end();
            options.onDone?.(event);
            return;
        }
      }
    }

    // Stream ended without explicit done event
    streamRenderer.end();
  } catch (err) {
    streamRenderer.end();
    throw err;
  }
}
