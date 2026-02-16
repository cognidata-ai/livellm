import type { EventBus } from './events';
import type { ActionsConfig, LiveLLMAction } from '../utils/types';

/**
 * @livellm/actions — Bidirectional action system.
 * Captures user interactions from components and routes them back to the chat platform.
 */
export class Actions {
  private events: EventBus;
  private config: ActionsConfig;

  constructor(events: EventBus, config: Partial<ActionsConfig> = {}) {
    this.events = events;
    this.config = {
      onAction: config.onAction || (() => {}),
      autoSend: config.autoSend ?? false,
      showPreview: config.showPreview ?? true,
      labelTemplates: config.labelTemplates || {},
    };

    // Listen for action events from the renderer
    this.events.on('action:triggered', this.handleAction.bind(this));
  }

  /**
   * Handle an incoming action from a component.
   */
  private handleAction(action: LiveLLMAction): void {
    // Apply custom label template if available
    const template = this.config.labelTemplates[action.component];
    if (template && typeof template === 'function') {
      action.label = template(action.value, action.metadata);
    }

    if (this.config.autoSend) {
      // Send immediately without confirmation
      this.send(action);
    } else {
      // Emit preview event — let the host UI show confirmation
      this.events.emit('action:previewing', action);
    }
  }

  /**
   * Send an action (called directly or after user confirmation).
   */
  send(action: LiveLLMAction): void {
    this.events.emit('action:confirmed', action);

    try {
      this.config.onAction(action);
      this.events.emit('action:sent', action);
    } catch (err) {
      console.error('[LiveLLM Actions] Error in onAction callback:', err);
    }
  }

  /**
   * Cancel a pending action.
   */
  cancel(action: LiveLLMAction): void {
    this.events.emit('action:cancelled', action);
  }

  /**
   * Update the actions configuration.
   */
  updateConfig(config: Partial<ActionsConfig>): void {
    Object.assign(this.config, config);
  }
}
