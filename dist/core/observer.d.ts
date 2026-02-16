import type { EventBus } from './events';
import type { Registry } from './registry';
import type { Parser } from './parser';
import type { Renderer } from './renderer';
/**
 * @livellm/observer — MutationObserver-based observe mode.
 * Watches DOM containers for new text content and automatically
 * renders livellm: blocks when detected.
 */
export interface ObserverOptions {
    /** CSS selector or element to observe */
    target: string | HTMLElement;
    /** Whether to observe child list changes */
    childList?: boolean;
    /** Whether to observe character data changes */
    characterData?: boolean;
    /** Whether to observe subtree */
    subtree?: boolean;
    /** Debounce delay in ms before processing mutations */
    debounce?: number;
}
export declare class Observer {
    private events;
    private registry;
    private parser;
    private renderer;
    private observer;
    private target;
    private debounceTimer;
    private options;
    constructor(events: EventBus, registry: Registry, parser: Parser, renderer: Renderer);
    /**
     * Start observing a target element for livellm: blocks.
     */
    observe(options: ObserverOptions): void;
    /**
     * Stop observing.
     */
    disconnect(): void;
    /**
     * Check if currently observing.
     */
    get isObserving(): boolean;
    /**
     * Handle incoming mutations with debouncing.
     */
    private handleMutations;
    /**
     * Scan the target element for unprocessed livellm: code blocks.
     */
    private scanTarget;
    /**
     * Process a single code block — parse and replace with component.
     */
    private processCodeBlock;
}
