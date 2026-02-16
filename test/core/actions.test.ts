import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../src/core/events';
import { Actions } from '../../src/core/actions';
import type { LiveLLMAction } from '../../src/utils/types';

function createAction(overrides: Partial<LiveLLMAction> = {}): LiveLLMAction {
  return {
    type: 'livellm:action',
    component: 'choice',
    action: 'select',
    value: 'option-a',
    label: 'I selected Option A',
    metadata: {
      componentId: 'test-id',
      timestamp: Date.now(),
    },
    ...overrides,
  };
}

describe('Actions', () => {
  let events: EventBus;

  beforeEach(() => {
    events = new EventBus();
  });

  it('should invoke onAction callback when autoSend is true', () => {
    const onAction = vi.fn();
    new Actions(events, { autoSend: true, onAction });

    const action = createAction();
    events.emit('action:triggered', action);

    expect(onAction).toHaveBeenCalledWith(action);
  });

  it('should emit action:previewing when autoSend is false', () => {
    const onPreviewing = vi.fn();
    events.on('action:previewing', onPreviewing);
    new Actions(events, { autoSend: false });

    const action = createAction();
    events.emit('action:triggered', action);

    expect(onPreviewing).toHaveBeenCalledWith(action);
  });

  it('should send action and emit events', () => {
    const onAction = vi.fn();
    const onConfirmed = vi.fn();
    const onSent = vi.fn();

    events.on('action:confirmed', onConfirmed);
    events.on('action:sent', onSent);

    const actions = new Actions(events, { onAction });
    const action = createAction();

    actions.send(action);

    expect(onConfirmed).toHaveBeenCalledWith(action);
    expect(onAction).toHaveBeenCalledWith(action);
    expect(onSent).toHaveBeenCalledWith(action);
  });

  it('should emit action:cancelled when cancelling', () => {
    const onCancelled = vi.fn();
    events.on('action:cancelled', onCancelled);

    const actions = new Actions(events);
    const action = createAction();

    actions.cancel(action);
    expect(onCancelled).toHaveBeenCalledWith(action);
  });

  it('should apply custom label templates', () => {
    const onAction = vi.fn();
    new Actions(events, {
      autoSend: true,
      onAction,
      labelTemplates: {
        choice: (value: any) => `Custom: ${value}`,
      },
    });

    const action = createAction({ component: 'choice', value: 'test-value' });
    events.emit('action:triggered', action);

    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Custom: test-value' })
    );
  });

  it('should handle errors in onAction callback gracefully', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onAction = vi.fn(() => { throw new Error('callback error'); });

    const actions = new Actions(events, { onAction });
    const action = createAction();

    expect(() => actions.send(action)).not.toThrow();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('should update config', () => {
    const onAction1 = vi.fn();
    const onAction2 = vi.fn();

    const actions = new Actions(events, { autoSend: true, onAction: onAction1 });

    const action1 = createAction();
    events.emit('action:triggered', action1);
    expect(onAction1).toHaveBeenCalledTimes(1);

    actions.updateConfig({ onAction: onAction2 });

    const action2 = createAction();
    events.emit('action:triggered', action2);
    expect(onAction2).toHaveBeenCalledTimes(1);
  });
});
