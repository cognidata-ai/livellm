import type { LiveLLMConfig, EventHandler, StreamRendererOptions } from '../utils/types';
import { Registry, RegisterOptions } from './registry';
import { Transformer } from './transformer';
import { StreamRenderer } from './stream-renderer';
import { Observer, ObserverOptions } from './observer';
/**
 * LiveLLM — Main facade class.
 * Orchestrates all modules and provides the public API.
 */
export declare class LiveLLMInstance {
    private config;
    private events;
    private _registry;
    private parser;
    private _renderer;
    private _transformer;
    private actions;
    private _observer;
    private initialized;
    readonly version: string;
    constructor();
    /**
     * Initialize LiveLLM with configuration.
     */
    init(userConfig?: Partial<LiveLLMConfig>): void;
    /**
     * Render markdown into a container element.
     */
    render(markdown: string, target: string | HTMLElement): HTMLElement | null;
    /**
     * Render markdown to an HTML string.
     */
    renderToString(markdown: string): string;
    /**
     * Create a stream renderer for token-by-token rendering.
     */
    createStreamRenderer(target: string | HTMLElement, options?: Partial<StreamRendererOptions>): StreamRenderer;
    /**
     * Transform raw markdown by detecting and enriching patterns.
     */
    transform(markdown: string): string;
    /**
     * Access the transformer for advanced configuration.
     */
    get transformer(): Transformer;
    /**
     * Register a component.
     */
    register(name: string, component: CustomElementConstructor | null, options?: RegisterOptions): void;
    /**
     * Access the registry for advanced operations.
     */
    get registry(): Registry;
    /**
     * Listen to an event.
     */
    on(event: string, handler: EventHandler): void;
    /**
     * Remove an event listener.
     */
    off(event: string, handler: EventHandler): void;
    /**
     * Listen to an event once.
     */
    once(event: string, handler: EventHandler): void;
    /**
     * Start observing a container for dynamic livellm: blocks.
     */
    observe(options: ObserverOptions): void;
    /**
     * Stop observing.
     */
    disconnect(): void;
    /**
     * Access the observer instance.
     */
    get observer(): Observer;
    /**
     * Destroy the LiveLLM instance and clean up.
     */
    destroy(): void;
    /**
     * Reset to initial state with default config.
     */
    reset(): void;
}
