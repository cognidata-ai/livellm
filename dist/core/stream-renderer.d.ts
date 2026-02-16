import type { EventBus } from './events';
import type { Registry } from './registry';
import type { Parser } from './parser';
import type { Renderer } from './renderer';
import type { StreamRendererOptions, StreamState } from '../utils/types';
/**
 * @livellm/streaming — Token-by-token stream renderer.
 *
 * The stream renderer processes tokens incrementally:
 * 1. Text tokens are accumulated and rendered as markdown in batches
 * 2. When a ```livellm: fence is detected, a skeleton placeholder appears
 * 3. The JSON body is buffered until the closing ```
 * 4. The skeleton is replaced with the real Web Component
 */
export declare class StreamRenderer {
    private events;
    private registry;
    private parser;
    private renderer;
    private config;
    private container;
    private fullBuffer;
    private textAccum;
    private fenceAccum;
    private componentType;
    private componentJson;
    private internalState;
    private textBlock;
    private pendingElement;
    private cursorElement;
    private aborted;
    private renderRAF;
    private textDirty;
    constructor(events: EventBus, registry: Registry, parser: Parser, renderer: Renderer, target: string | HTMLElement, options?: Partial<StreamRendererOptions>);
    /**
     * Push a token (text chunk) into the stream.
     */
    push(token: string): void;
    /**
     * Signal the end of the stream.
     */
    end(): void;
    /**
     * Abort the stream.
     */
    abort(): void;
    /**
     * Get the current stream state.
     */
    getState(): StreamState;
    /**
     * Get the full accumulated text.
     */
    getFullText(): string;
    /**
     * Connect to a ReadableStream (fetch API).
     */
    connectStream(stream: ReadableStream<Uint8Array>, extractToken?: (chunk: string) => string): Promise<void>;
    /**
     * Connect to Server-Sent Events.
     */
    connectSSE(source: EventSource, options: {
        eventName?: string;
        extractToken: (data: string) => string;
        doneSignal?: string;
    }): void;
    /**
     * Connect to a WebSocket.
     */
    connectWebSocket(ws: WebSocket, options: {
        extractToken: (message: MessageEvent) => string;
        doneSignal?: string;
    }): void;
    private processChar;
    /**
     * In TEXT state: accumulate normal text, watch for ``` fence start.
     */
    private processTextChar;
    /**
     * In FENCE_MAYBE state: we have ```, now check if it's livellm: or not.
     */
    private processFenceChar;
    /**
     * In COMPONENT state: buffering JSON body of a livellm block.
     */
    private processComponentChar;
    /**
     * Schedule a DOM render on the next animation frame.
     */
    private scheduleRender;
    /**
     * Render the current text accumulator as markdown.
     */
    private renderCurrentText;
    /**
     * Flush accumulated text and start a new text block.
     */
    private flushText;
    /**
     * Replace skeleton with the real Web Component.
     */
    private finalizeComponent;
    private replaceWithFallback;
    private replaceWithError;
    private flushComponentAsFallback;
    private insertSkeleton;
    private createCursor;
    private moveCursorToEnd;
    private removeCursor;
    private escapeHtml;
}
