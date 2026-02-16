// ═══════════════════════════════════════════════════════════════
// LiveLLM Response Protocol — Server Helpers
//
// Utilities for any Node.js server to emit SSE events
// conforming to the LiveLLM protocol.
// ═══════════════════════════════════════════════════════════════

import type {
  TokenEvent,
  ErrorEvent,
  MetadataEvent,
  DoneEvent,
  UsageInfo,
} from './types';

/**
 * Minimal interface for a writable HTTP response.
 * Works with Express, raw Node http, Koa, Fastify, etc.
 */
export interface SSEWritable {
  setHeader(name: string, value: string): void;
  write(chunk: string): boolean;
  end(): void;
}

/**
 * SSE writer that emits LiveLLM-protocol-conforming events.
 */
export interface SSEWriter {
  /** Set required SSE headers. Call before writing any events. */
  writeHeaders(): void;
  /** Emit a token event. */
  token(text: string): void;
  /** Emit an error event. */
  error(
    code: ErrorEvent['code'],
    message: string,
    recoverable?: boolean
  ): void;
  /** Emit a metadata event (model info, usage stats, latency). */
  metadata(meta: {
    model?: string;
    provider?: string;
    usage?: UsageInfo;
    latency_ms?: number;
  }): void;
  /** Emit the done event and end the response. */
  done(fullText?: string): void;
}

/**
 * Create an SSE writer bound to a server response object.
 *
 * @example
 * ```js
 * import { createSSEWriter } from 'livellm/protocol';
 *
 * app.post('/api/chat/stream', (req, res) => {
 *   const sse = createSSEWriter(res);
 *   sse.writeHeaders();
 *   sse.metadata({ model: 'llama-3.3-70b', provider: 'groq' });
 *
 *   // For each token from the LLM:
 *   sse.token('Hello');
 *   sse.token(' world');
 *
 *   // On completion:
 *   sse.done();
 * });
 * ```
 */
export function createSSEWriter(res: SSEWritable): SSEWriter {
  const writeLine = (event: TokenEvent | ErrorEvent | MetadataEvent | DoneEvent): void => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  return {
    writeHeaders(): void {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
    },

    token(text: string): void {
      writeLine({ type: 'token', token: text });
    },

    error(
      code: ErrorEvent['code'],
      message: string,
      recoverable: boolean = false
    ): void {
      writeLine({ type: 'error', code, message, recoverable });
    },

    metadata(meta: {
      model?: string;
      provider?: string;
      usage?: UsageInfo;
      latency_ms?: number;
    }): void {
      writeLine({ type: 'metadata', ...meta });
    },

    done(fullText?: string): void {
      const event: DoneEvent = { type: 'done' };
      if (fullText !== undefined) {
        event.fullText = fullText;
      }
      writeLine(event);
      res.end();
    },
  };
}

/**
 * Format a LiveLLMActionPayload into a natural language string
 * suitable for injecting into the LLM conversation history.
 *
 * @example
 * ```js
 * const text = formatActionAsMessage(action);
 * // "User selected: React (from choice component)"
 * history.push({ role: 'user', content: text });
 * ```
 */
export function formatActionAsMessage(action: {
  component: string;
  action: string;
  value: any;
  label: string;
  context?: string;
}): string {
  const parts: string[] = [];

  if (action.context) {
    parts.push(`[Re: "${action.context}"]`);
  }

  switch (action.action) {
    case 'select':
      parts.push(`User selected: ${action.label}`);
      break;
    case 'confirm': {
      let msg = 'User confirmed';
      if (action.label && action.label !== 'Yes') {
        msg += `: ${action.label}`;
      }
      parts.push(msg);
      break;
    }
    case 'cancel': {
      let msg = 'User cancelled';
      if (action.label && action.label !== 'No') {
        msg += `: ${action.label}`;
      }
      parts.push(msg);
      break;
    }
    case 'submit':
      parts.push(`User submitted: ${JSON.stringify(action.value)}`);
      break;
    case 'change':
      parts.push(`User set ${action.label || action.component} to: ${action.value}`);
      break;
    default:
      parts.push(`User action (${action.action}): ${action.label || JSON.stringify(action.value)}`);
  }

  return parts.join(' ');
}
