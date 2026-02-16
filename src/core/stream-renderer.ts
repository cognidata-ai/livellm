import type { EventBus } from './events';
import type { Registry } from './registry';
import type { Parser } from './parser';
import type { Renderer } from './renderer';
import type { StreamRendererOptions, StreamState } from '../utils/types';
import { resolveContainer, scrollToBottom } from '../utils/dom';

/**
 * States for the streaming state machine.
 *
 * IDLE         → nothing started yet
 * TEXT         → accumulating normal markdown text
 * FENCE_MAYBE  → saw backticks, might be a livellm fence
 * COMPONENT    → inside a livellm: block, buffering JSON
 * DONE         → stream ended
 */
type InternalState = 'IDLE' | 'TEXT' | 'FENCE_MAYBE' | 'COMPONENT' | 'DONE';

/**
 * @livellm/streaming — Token-by-token stream renderer.
 *
 * The stream renderer processes tokens incrementally:
 * 1. Text tokens are accumulated and rendered as markdown in batches
 * 2. When a ```livellm: fence is detected, a skeleton placeholder appears
 * 3. The JSON body is buffered until the closing ```
 * 4. The skeleton is replaced with the real Web Component
 */
export class StreamRenderer {
  private events: EventBus;
  private registry: Registry;
  private parser: Parser;
  private renderer: Renderer;
  private config: StreamRendererOptions;

  private container: HTMLElement;
  private fullBuffer: string = '';            // Complete accumulated text
  private textAccum: string = '';             // Current text segment being accumulated
  private fenceAccum: string = '';            // Accumulator for partial fence detection
  private componentType: string = '';         // Type of component being buffered
  private componentJson: string = '';         // JSON body being buffered
  private internalState: InternalState = 'IDLE';
  private textBlock: HTMLElement | null = null;
  private pendingElement: HTMLElement | null = null;
  private cursorElement: HTMLElement | null = null;
  private aborted: boolean = false;
  private renderRAF: number | null = null;
  private textDirty: boolean = false;

  constructor(
    events: EventBus,
    registry: Registry,
    parser: Parser,
    renderer: Renderer,
    target: string | HTMLElement,
    options: Partial<StreamRendererOptions> = {}
  ) {
    this.events = events;
    this.registry = registry;
    this.parser = parser;
    this.renderer = renderer;

    const resolved = resolveContainer(target);
    if (!resolved) {
      throw new Error('[LiveLLM StreamRenderer] Container not found');
    }
    this.container = resolved;

    this.config = {
      tokenDelay: options.tokenDelay ?? 0,
      skeletonDelay: options.skeletonDelay ?? 200,
      transformOnComplete: options.transformOnComplete ?? true,
      transformDuringStream: options.transformDuringStream ?? false,
      autoScroll: options.autoScroll ?? true,
      showCursor: options.showCursor ?? true,
      cursorChar: options.cursorChar ?? '▊',
      onStart: options.onStart,
      onToken: options.onToken,
      onComponentStart: options.onComponentStart,
      onComponentComplete: options.onComponentComplete,
      onEnd: options.onEnd,
      onError: options.onError,
    };

    if (this.config.showCursor) {
      this.createCursor();
    }
  }

  // ═══ Public API ═══════════════════════════════════════════

  /**
   * Push a token (text chunk) into the stream.
   */
  push(token: string): void {
    if (this.aborted) return;

    if (this.internalState === 'IDLE') {
      this.internalState = 'TEXT';
      this.events.emit('stream:connected', 'manual');
      this.config.onStart?.();
    }

    this.fullBuffer += token;
    this.config.onToken?.(token);
    this.events.emit('stream:token', token);

    // Process character by character for precise fence detection
    for (const ch of token) {
      this.processChar(ch);
    }

    // Schedule a render if text changed
    this.scheduleRender();
  }

  /**
   * Signal the end of the stream.
   */
  end(): void {
    if (this.aborted) return;

    // Flush any in-progress state
    if (this.internalState === 'FENCE_MAYBE') {
      // The fence never completed — treat as normal text
      this.textAccum += this.fenceAccum;
      this.fenceAccum = '';
    } else if (this.internalState === 'COMPONENT') {
      // Component never closed — render as fallback
      this.flushComponentAsFallback();
    }

    // Flush any residual backticks held in fenceAccum (TEXT/IDLE state).
    // processTextChar() holds 1-2 backticks waiting to see if they become ```.
    // Without this, the closing backtick of inline components like
    // `livellm:alert{...}` gets lost, preventing parser from forming code_inline tokens.
    if (this.fenceAccum) {
      this.textAccum += this.fenceAccum;
      this.fenceAccum = '';
    }

    // Final text render
    this.flushText();
    this.removeCursor();

    // Cancel any pending RAF
    if (this.renderRAF !== null) {
      cancelAnimationFrame(this.renderRAF);
      this.renderRAF = null;
    }

    // Bind actions to all rendered components
    this.renderer.bindActions(this.container);

    this.internalState = 'DONE';
    this.config.onEnd?.(this.fullBuffer);
    this.events.emit('stream:end', this.fullBuffer);
  }

  /**
   * Abort the stream.
   */
  abort(): void {
    this.aborted = true;
    this.removeCursor();
    if (this.renderRAF !== null) {
      cancelAnimationFrame(this.renderRAF);
      this.renderRAF = null;
    }
    this.internalState = 'DONE';
  }

  /**
   * Get the current stream state.
   */
  getState(): StreamState {
    switch (this.internalState) {
      case 'IDLE': return 'IDLE';
      case 'TEXT': return 'RENDERING';
      case 'FENCE_MAYBE': return 'DETECTING';
      case 'COMPONENT': return 'BUFFERING';
      case 'DONE': return 'INTERACTIVE';
    }
  }

  /**
   * Get the full accumulated text.
   */
  getFullText(): string {
    return this.fullBuffer;
  }

  // ═══ Stream Adapters ═════════════════════════════════════

  /**
   * Connect to a ReadableStream (fetch API).
   */
  async connectStream(
    stream: ReadableStream<Uint8Array>,
    extractToken?: (chunk: string) => string
  ): Promise<void> {
    this.events.emit('stream:connected', 'ReadableStream');
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done || this.aborted) break;

        const chunk = decoder.decode(value, { stream: true });
        const token = extractToken ? extractToken(chunk) : chunk;
        if (token) this.push(token);
      }
      if (!this.aborted) this.end();
    } catch (err) {
      this.config.onError?.(err as Error);
      this.events.emit('stream:error', err);
    }
  }

  /**
   * Connect to Server-Sent Events.
   */
  connectSSE(
    source: EventSource,
    options: {
      eventName?: string;
      extractToken: (data: string) => string;
      doneSignal?: string;
    }
  ): void {
    this.events.emit('stream:connected', 'SSE');
    const eventName = options.eventName || 'message';

    const handler = (event: Event) => {
      if (this.aborted) {
        source.removeEventListener(eventName, handler);
        return;
      }
      const data = (event as MessageEvent).data;
      if (options.doneSignal && data === options.doneSignal) {
        source.close();
        this.end();
        return;
      }
      const token = options.extractToken(data);
      if (token) this.push(token);
    };

    source.addEventListener(eventName, handler);
    source.addEventListener('error', () => {
      if (!this.aborted) this.end();
    });
  }

  /**
   * Connect to a WebSocket.
   */
  connectWebSocket(
    ws: WebSocket,
    options: {
      extractToken: (message: MessageEvent) => string;
      doneSignal?: string;
    }
  ): void {
    this.events.emit('stream:connected', 'WebSocket');

    ws.addEventListener('message', (event: MessageEvent) => {
      if (this.aborted) return;
      if (options.doneSignal && event.data === options.doneSignal) {
        this.end();
        return;
      }
      const token = options.extractToken(event);
      if (token) this.push(token);
    });

    ws.addEventListener('close', () => {
      if (!this.aborted && this.internalState !== 'DONE') this.end();
    });
    ws.addEventListener('error', () => {
      if (!this.aborted && this.internalState !== 'DONE') this.end();
    });
  }

  // ═══ Character-level state machine ═══════════════════════

  private processChar(ch: string): void {
    switch (this.internalState) {
      case 'TEXT':
        this.processTextChar(ch);
        break;
      case 'FENCE_MAYBE':
        this.processFenceChar(ch);
        break;
      case 'COMPONENT':
        this.processComponentChar(ch);
        break;
    }
  }

  /**
   * In TEXT state: accumulate normal text, watch for ``` fence start.
   */
  private processTextChar(ch: string): void {
    this.fenceAccum += ch;

    // We're looking for: ```livellm:<type>\n
    // Build up the fence accumulator to detect ``` at line start
    if (this.fenceAccum === '`' || this.fenceAccum === '``') {
      // Partial backtick sequence — keep accumulating
      return;
    }

    if (this.fenceAccum === '```') {
      // Three backticks — might be a fence, switch to FENCE_MAYBE
      this.internalState = 'FENCE_MAYBE';
      return;
    }

    // Not a fence — flush the fence accumulator to text
    this.textAccum += this.fenceAccum;
    this.fenceAccum = '';
    this.textDirty = true;
  }

  /**
   * In FENCE_MAYBE state: we have ```, now check if it's livellm: or not.
   */
  private processFenceChar(ch: string): void {
    this.fenceAccum += ch;

    // We need to accumulate until we can determine if this is ```livellm:<type>\n
    const afterBackticks = this.fenceAccum.substring(3); // Everything after ```

    if (ch === '\n') {
      // End of the info line — check if it's a livellm component
      const info = afterBackticks.slice(0, -1).trim(); // Remove the \n
      const livellmMatch = info.match(/^livellm:([\w][\w-]*)$/);

      if (livellmMatch) {
        // It's a livellm component! Flush any pending text and start buffering
        this.flushText();
        this.componentType = livellmMatch[1];
        this.componentJson = '';
        this.internalState = 'COMPONENT';
        this.fenceAccum = '';

        this.events.emit('stream:component:start', this.componentType);
        this.config.onComponentStart?.(this.componentType);
        this.insertSkeleton(this.componentType);
      } else {
        // Regular code fence — treat as normal text
        this.textAccum += this.fenceAccum;
        this.fenceAccum = '';
        this.internalState = 'TEXT';
        this.textDirty = true;
      }
    } else if (afterBackticks.length > 50) {
      // Too long for a fence info string — treat as text
      this.textAccum += this.fenceAccum;
      this.fenceAccum = '';
      this.internalState = 'TEXT';
      this.textDirty = true;
    }
    // Otherwise keep accumulating in FENCE_MAYBE
  }

  /**
   * In COMPONENT state: buffering JSON body of a livellm block.
   */
  private processComponentChar(ch: string): void {
    this.componentJson += ch;

    // Look for the closing \n```
    if (this.componentJson.endsWith('\n```')) {
      // Component is complete!
      const jsonStr = this.componentJson.slice(0, -4).trim();
      const type = this.componentType;

      this.componentJson = '';
      this.componentType = '';
      this.fenceAccum = '';
      this.internalState = 'TEXT';

      this.finalizeComponent(type, jsonStr);
    }
  }

  // ═══ Rendering ═══════════════════════════════════════════

  /**
   * Schedule a DOM render on the next animation frame.
   */
  private scheduleRender(): void {
    if (this.renderRAF !== null) return;
    if (!this.textDirty) return;

    this.renderRAF = requestAnimationFrame(() => {
      this.renderRAF = null;
      if (this.textDirty) {
        this.renderCurrentText();
        this.textDirty = false;
      }
    });
  }

  /**
   * Render the current text accumulator as markdown.
   */
  private renderCurrentText(): void {
    if (!this.textAccum.trim()) return;

    const html = this.parser.parse(this.textAccum);

    if (!this.textBlock) {
      this.textBlock = document.createElement('div');
      this.textBlock.className = 'livellm-stream-block livellm-prose';
      this.container.appendChild(this.textBlock);
    }

    this.textBlock.innerHTML = html;
    this.moveCursorToEnd();

    if (this.config.autoScroll) {
      scrollToBottom(this.container);
    }
  }

  /**
   * Flush accumulated text and start a new text block.
   */
  private flushText(): void {
    if (this.textAccum.trim()) {
      this.renderCurrentText();
    }
    this.textAccum = '';
    this.textBlock = null;
    this.textDirty = false;
  }

  /**
   * Replace skeleton with the real Web Component.
   */
  private finalizeComponent(type: string, jsonStr: string): void {
    try {
      const props = JSON.parse(jsonStr);
      const registration = this.registry.get(type);

      if (this.pendingElement) {
        if (registration) {
          const finalProps = this.registry.applyDefaults(type, props);
          const validation = this.registry.validate(type, props);

          if (validation.valid) {
            const componentEl = document.createElement(registration.tagName);
            componentEl.setAttribute('data-livellm', type);
            componentEl.setAttribute('data-props', JSON.stringify(finalProps));
            this.pendingElement.replaceWith(componentEl);

            this.events.emit('renderer:component:mounted', type, componentEl);
          } else {
            // Validation failed — show error
            this.replaceWithError(type, jsonStr, validation.errors);
          }
        } else {
          // Unknown component — show fallback
          this.replaceWithFallback(type, jsonStr);
        }
      }

      this.pendingElement = null;
      this.config.onComponentComplete?.(type, props);
      this.events.emit('stream:component:complete', type, props);
    } catch {
      this.flushComponentAsFallback();
    }

    // Start new text block for anything after the component
    this.textBlock = null;
  }

  private replaceWithFallback(type: string, content: string): void {
    if (!this.pendingElement) return;
    const fallback = document.createElement('div');
    fallback.className = 'livellm-fallback';
    fallback.innerHTML =
      `<pre><code class="language-livellm:${this.escapeHtml(type)}">${this.escapeHtml(content)}</code></pre>`;
    this.pendingElement.replaceWith(fallback);
    this.pendingElement = null;
  }

  private replaceWithError(
    type: string,
    content: string,
    errors: Array<{ prop: string; message: string }>
  ): void {
    if (!this.pendingElement) return;
    const errorList = errors.map((e) => `<li>${this.escapeHtml(e.message)}</li>`).join('');
    const errorEl = document.createElement('div');
    errorEl.className = 'livellm-error';
    errorEl.innerHTML =
      `<div class="livellm-error-header">Component "${this.escapeHtml(type)}" — validation errors:</div>` +
      `<ul class="livellm-error-list">${errorList}</ul>` +
      `<pre><code>${this.escapeHtml(content)}</code></pre>`;
    this.pendingElement.replaceWith(errorEl);
    this.pendingElement = null;
  }

  private flushComponentAsFallback(): void {
    if (!this.pendingElement) return;
    this.replaceWithFallback(this.componentType, this.componentJson);
    this.componentType = '';
    this.componentJson = '';
  }

  // ═══ Skeleton ════════════════════════════════════════════

  private insertSkeleton(type: string): void {
    // Close current text block
    this.flushText();

    const skeleton = this.registry.getSkeleton(type);
    this.pendingElement = document.createElement('div');
    this.pendingElement.className = 'livellm-skeleton-wrapper';
    this.pendingElement.setAttribute('data-pending', type);
    this.pendingElement.innerHTML = skeleton.html;
    this.pendingElement.style.minHeight = skeleton.height;

    this.container.appendChild(this.pendingElement);

    if (this.config.autoScroll) {
      scrollToBottom(this.container);
    }
  }

  // ═══ Cursor ══════════════════════════════════════════════

  private createCursor(): void {
    this.cursorElement = document.createElement('span');
    this.cursorElement.className = 'livellm-cursor';
    this.cursorElement.textContent = this.config.cursorChar;
    this.cursorElement.setAttribute('aria-hidden', 'true');
  }

  private moveCursorToEnd(): void {
    if (!this.cursorElement) return;
    this.cursorElement.remove();
    this.container.appendChild(this.cursorElement);
  }

  private removeCursor(): void {
    this.cursorElement?.remove();
    this.cursorElement = null;
  }

  // ═══ Utils ═══════════════════════════════════════════════

  private escapeHtml(str: string): string {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
