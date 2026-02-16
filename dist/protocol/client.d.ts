import type { StreamEvent, MetadataEvent, ErrorEvent, DoneEvent } from './types';
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
export declare function parseSSEData(data: string): StreamEvent | null;
/**
 * Parse a full SSE line (including `data: ` prefix) into a StreamEvent.
 * Returns `null` if the line is not a valid SSE data line.
 */
export declare function parseSSELine(line: string): StreamEvent | null;
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
export declare function connectLiveLLMStream(response: Response, streamRenderer: StreamRendererLike, options?: ConnectStreamOptions): Promise<void>;
