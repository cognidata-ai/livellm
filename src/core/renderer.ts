import type { EventBus } from './events';
import type { Registry } from './registry';
import type { Parser } from './parser';
import type { RendererConfig, LiveLLMAction } from '../utils/types';
import { resolveContainer } from '../utils/dom';
import { sanitizeHTML } from '../utils/sanitize';

/**
 * @livellm/renderer — DOM renderer.
 * Takes parsed HTML from the Parser and inserts it into the DOM.
 * Handles Web Component instantiation and action binding.
 */
export class Renderer {
  private events: EventBus;
  private registry: Registry;
  private parser: Parser;
  private config: RendererConfig;

  constructor(
    events: EventBus,
    registry: Registry,
    parser: Parser,
    config: Partial<RendererConfig> = {}
  ) {
    this.events = events;
    this.registry = registry;
    this.parser = parser;
    this.config = {
      shadowDom: config.shadowDom ?? true,
      sanitize: config.sanitize ?? true,
      proseStyles: config.proseStyles ?? true,
    };
  }

  /**
   * Render markdown into a container element.
   */
  render(markdown: string, target: string | HTMLElement): HTMLElement | null {
    const container = resolveContainer(target);
    if (!container) {
      console.error('[LiveLLM Renderer] Container not found:', target);
      return null;
    }

    this.events.emit('renderer:start');

    // Parse markdown to HTML (with LiveLLM components)
    let html = this.parser.parse(markdown);

    // Sanitize if enabled
    if (this.config.sanitize) {
      html = sanitizeHTML(html);
    }

    // Wrap in prose container for typography styles
    if (this.config.proseStyles) {
      html = `<div class="livellm-prose">${html}</div>`;
    }

    // Set HTML content
    container.innerHTML = html;

    // Bind action listeners to LiveLLM components in the container
    this.bindActions(container);

    this.events.emit('renderer:complete');

    return container;
  }

  /**
   * Render markdown to an HTML string (for SSR or pre-rendering).
   */
  renderToString(markdown: string): string {
    let html = this.parser.parse(markdown);
    if (this.config.sanitize) {
      html = sanitizeHTML(html);
    }
    if (this.config.proseStyles) {
      html = `<div class="livellm-prose">${html}</div>`;
    }
    return html;
  }

  /**
   * Bind livellm:action event listeners to all LiveLLM components in a container.
   */
  bindActions(container: HTMLElement): void {
    container.addEventListener('livellm:action', ((event: CustomEvent) => {
      const detail = event.detail;
      if (!detail) return;

      const action: LiveLLMAction = {
        type: 'livellm:action',
        component: detail.component,
        action: detail.action,
        value: detail.data?.value ?? detail.data,
        label: detail.data?.label ?? '',
        metadata: {
          componentId: detail.componentId || '',
          timestamp: detail.timestamp || Date.now(),
          questionContext: detail.data?.questionContext,
        },
      };

      this.events.emit('action:triggered', action);
    }) as EventListener);
  }

  /**
   * Clear a container's content.
   */
  clear(target: string | HTMLElement): void {
    const container = resolveContainer(target);
    if (container) {
      container.innerHTML = '';
    }
  }
}
