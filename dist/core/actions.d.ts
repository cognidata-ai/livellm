import type { EventBus } from './events';
import type { ActionsConfig, LiveLLMAction } from '../utils/types';
/**
 * @livellm/actions — Bidirectional action system.
 * Captures user interactions from components and routes them back to the chat platform.
 */
export declare class Actions {
    private events;
    private config;
    constructor(events: EventBus, config?: Partial<ActionsConfig>);
    /**
     * Handle an incoming action from a component.
     */
    private handleAction;
    /**
     * Send an action (called directly or after user confirmation).
     */
    send(action: LiveLLMAction): void;
    /**
     * Cancel a pending action.
     */
    cancel(action: LiveLLMAction): void;
    /**
     * Update the actions configuration.
     */
    updateConfig(config: Partial<ActionsConfig>): void;
}
