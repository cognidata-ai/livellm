import type { EventHandler, EventMap } from '../utils/types';

/**
 * @livellm/events — Central event bus.
 * All modules emit events through this bus.
 */
export class EventBus {
  private handlers: EventMap = {};
  private debug: boolean = false;

  setDebug(enabled: boolean): void {
    this.debug = enabled;
  }

  /**
   * Register an event handler.
   */
  on(event: string, handler: EventHandler): void {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    this.handlers[event].push(handler);
  }

  /**
   * Remove an event handler.
   */
  off(event: string, handler: EventHandler): void {
    const list = this.handlers[event];
    if (!list) return;

    const idx = list.indexOf(handler);
    if (idx !== -1) {
      list.splice(idx, 1);
    }

    if (list.length === 0) {
      delete this.handlers[event];
    }
  }

  /**
   * Register a one-time event handler.
   */
  once(event: string, handler: EventHandler): void {
    const wrapper: EventHandler = (...args: any[]) => {
      this.off(event, wrapper);
      handler(...args);
    };
    this.on(event, wrapper);
  }

  /**
   * Emit an event to all registered handlers.
   */
  emit(event: string, ...args: any[]): void {
    if (this.debug) {
      console.log(`[LiveLLM Event] ${event}`, ...args);
    }

    const list = this.handlers[event];
    if (!list) return;

    // Copy the list to avoid issues if handlers modify the list
    const snapshot = [...list];
    for (const handler of snapshot) {
      try {
        handler(...args);
      } catch (err) {
        console.error(`[LiveLLM] Error in event handler for "${event}":`, err);
      }
    }
  }

  /**
   * Remove all handlers for an event, or all handlers entirely.
   */
  removeAll(event?: string): void {
    if (event) {
      delete this.handlers[event];
    } else {
      this.handlers = {};
    }
  }

  /**
   * Get the count of handlers for an event.
   */
  listenerCount(event: string): number {
    return this.handlers[event]?.length ?? 0;
  }
}
