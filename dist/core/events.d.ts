import type { EventHandler } from '../utils/types';
/**
 * @livellm/events — Central event bus.
 * All modules emit events through this bus.
 */
export declare class EventBus {
    private handlers;
    private debug;
    setDebug(enabled: boolean): void;
    /**
     * Register an event handler.
     */
    on(event: string, handler: EventHandler): void;
    /**
     * Remove an event handler.
     */
    off(event: string, handler: EventHandler): void;
    /**
     * Register a one-time event handler.
     */
    once(event: string, handler: EventHandler): void;
    /**
     * Emit an event to all registered handlers.
     */
    emit(event: string, ...args: any[]): void;
    /**
     * Remove all handlers for an event, or all handlers entirely.
     */
    removeAll(event?: string): void;
    /**
     * Get the count of handlers for an event.
     */
    listenerCount(event: string): number;
}
