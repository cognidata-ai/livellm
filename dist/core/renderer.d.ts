import type { EventBus } from './events';
import type { Registry } from './registry';
import type { Parser } from './parser';
import type { RendererConfig } from '../utils/types';
/**
 * @livellm/renderer — DOM renderer.
 * Takes parsed HTML from the Parser and inserts it into the DOM.
 * Handles Web Component instantiation and action binding.
 */
export declare class Renderer {
    private events;
    private registry;
    private parser;
    private config;
    constructor(events: EventBus, registry: Registry, parser: Parser, config?: Partial<RendererConfig>);
    /**
     * Render markdown into a container element.
     */
    render(markdown: string, target: string | HTMLElement): HTMLElement | null;
    /**
     * Render markdown to an HTML string (for SSR or pre-rendering).
     */
    renderToString(markdown: string): string;
    /**
     * Bind livellm:action event listeners to all LiveLLM components in a container.
     */
    bindActions(container: HTMLElement): void;
    /**
     * Clear a container's content.
     */
    clear(target: string | HTMLElement): void;
}
