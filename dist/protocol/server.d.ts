import type { ErrorEvent, UsageInfo } from './types';
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
    error(code: ErrorEvent['code'], message: string, recoverable?: boolean): void;
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
export declare function createSSEWriter(res: SSEWritable): SSEWriter;
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
export declare function formatActionAsMessage(action: {
    component: string;
    action: string;
    value: any;
    label: string;
    context?: string;
}): string;
