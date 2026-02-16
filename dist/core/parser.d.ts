import MarkdownIt from 'markdown-it';
import type { EventBus } from './events';
import type { Registry } from './registry';
import type { MarkdownConfig } from '../utils/types';
/**
 * @livellm/parser — Markdown parser with LiveLLM component support.
 * Extends markdown-it to detect livellm: code fences and inline code.
 */
export declare class Parser {
    private md;
    private events;
    private registry;
    constructor(events: EventBus, registry: Registry, config?: Partial<MarkdownConfig>);
    /**
     * Parse markdown string to HTML with LiveLLM components.
     */
    parse(markdown: string): string;
    /**
     * Get the markdown-it instance for advanced configuration.
     */
    getMarkdownIt(): MarkdownIt;
    /**
     * markdown-it plugin that handles livellm: code fences and inline code.
     */
    private livellmPlugin;
    /**
     * Render a livellm: code fence block as a Web Component placeholder.
     */
    private renderLiveLLMBlock;
    /**
     * Render a livellm: inline code as an inline Web Component.
     */
    private renderLiveLLMInline;
    /**
     * Render a fallback code block when the component is unknown or format is invalid.
     */
    private renderFallback;
    /**
     * Render an error display when props are invalid.
     */
    private renderError;
    private escapeHtml;
    private escapeAttr;
}
