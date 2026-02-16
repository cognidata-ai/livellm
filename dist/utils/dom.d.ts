/**
 * DOM utility functions for LiveLLM renderer.
 */
/**
 * Resolve a container from a string selector or HTMLElement.
 */
export declare function resolveContainer(target: string | HTMLElement): HTMLElement | null;
export declare function generateComponentId(type: string): string;
/**
 * Scroll an element's parent to make it visible.
 */
export declare function scrollToBottom(container: HTMLElement): void;
/**
 * Create an element with attributes and optional children.
 */
export declare function createElement(tag: string, attrs?: Record<string, string>, children?: (Node | string)[]): HTMLElement;
